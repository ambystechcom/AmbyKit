/**
 * Reading a headless runner's final result (feature 033, live check of the `claude` runner on Windows). Exit code 0 does
 * not prove a lane did its work: plain `claude -p` exited 0 after every edit was refused. With `--output-format json`
 * Claude Code ends with one JSON object; this reads it for usage (so a token ceiling can be enforced) and for the signs
 * of a failed turn. Pure: the caller passes the captured stdout.
 */

export interface RunnerUsage {
  /** Input plus output tokens over every model the run used; cache reads and writes are not counted. */
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  costUSD?: number;
}

export interface RunnerResult {
  /** Set when the result itself says the turn failed (`is_error`, or a `subtype` other than `success`). */
  failed?: string;
  /** Tools the assistant asked for and was refused, by name, in first-seen order. */
  deniedTools: string[];
  usage?: RunnerUsage;
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The last JSON object in the output: the whole text, else its last line that parses (a banner or warning may precede it). */
function lastJsonObject(stdout: string): Json | undefined {
  const text = stdout.trim();
  if (text === "") return undefined;
  const tryParse = (s: string): Json | undefined => {
    try {
      const v: unknown = JSON.parse(s);
      return isObj(v) ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const whole = tryParse(text);
  if (whole) return whole;
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line.startsWith("{")) {
      const v = tryParse(line);
      if (v) return v;
    }
  }
  return undefined;
}

function readUsage(r: Json): RunnerUsage | undefined {
  // `modelUsage` (per model) is the complete record; `usage` (the last model's) is the fallback.
  if (isObj(r["modelUsage"])) {
    let inputTokens = 0;
    let outputTokens = 0;
    let costUSD = 0;
    let cost = false;
    for (const m of Object.values(r["modelUsage"])) {
      if (!isObj(m)) continue;
      inputTokens += num(m["inputTokens"]);
      outputTokens += num(m["outputTokens"]);
      if (typeof m["costUSD"] === "number") {
        costUSD += m["costUSD"];
        cost = true;
      }
    }
    if (typeof r["total_cost_usd"] === "number") {
      costUSD = r["total_cost_usd"];
      cost = true;
    }
    return { tokens: inputTokens + outputTokens, inputTokens, outputTokens, ...(cost ? { costUSD } : {}) };
  }
  if (isObj(r["usage"])) {
    const inputTokens = num(r["usage"]["input_tokens"]);
    const outputTokens = num(r["usage"]["output_tokens"]);
    const cost = typeof r["total_cost_usd"] === "number" ? { costUSD: r["total_cost_usd"] } : {};
    return { tokens: inputTokens + outputTokens, inputTokens, outputTokens, ...cost };
  }
  return undefined;
}

/**
 * Claude Code's `--output-format json` result. Returns `undefined` when the output holds no result object (an older
 * version, or a crash before the result): the caller then falls back to the exit code and the task list, as before.
 */
export function parseClaudeResult(stdout: string): RunnerResult | undefined {
  const r = lastJsonObject(stdout);
  if (!r || (r["type"] !== undefined && r["type"] !== "result")) return undefined;
  if (r["subtype"] === undefined && r["is_error"] === undefined && r["result"] === undefined) return undefined;
  const deniedTools: string[] = [];
  if (Array.isArray(r["permission_denials"])) {
    for (const d of r["permission_denials"]) {
      const name = isObj(d) && typeof d["tool_name"] === "string" ? d["tool_name"] : "unknown tool";
      if (!deniedTools.includes(name)) deniedTools.push(name);
    }
  }
  let failed: string | undefined;
  if (r["is_error"] === true) failed = `the result reports an error${typeof r["subtype"] === "string" ? ` (${r["subtype"]})` : ""}`;
  else if (typeof r["subtype"] === "string" && r["subtype"] !== "success") failed = `the result ended as '${r["subtype"]}', not 'success'`;
  const usage = readUsage(r);
  return { ...(failed ? { failed } : {}), deniedTools, ...(usage ? { usage } : {}) };
}

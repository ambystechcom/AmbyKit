import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClaudeResult } from "../../src/core/run-result.js";

/**
 * Reading the claude runner's JSON result (033 FR-004, FR-005). The fixture is the result of a real lane run on Windows
 * (claude 2.1.332, `--output-format json`), trimmed to the fields AmbyKit reads.
 */
const recorded = readFileSync(join(__dirname, "..", "fixtures", "runners", "claude-result-success.json"), "utf8");
const withFields = (over: Record<string, unknown>): string => JSON.stringify({ ...JSON.parse(recorded), ...over });

describe("claude result (033, live check)", () => {
  it("033:FR-004: the recorded successful result: not failed, usage summed over models, refused tools listed", () => {
    const r = parseClaudeResult(recorded)!;
    expect(r.failed).toBeUndefined();
    expect(r.usage).toMatchObject({ inputTokens: 14, outputTokens: 1533, tokens: 1547 });
    expect(r.usage!.costUSD).toBeCloseTo(0.2046, 3);
    // the recorded run tried PowerShell first and was refused (before PowerShell was in the allowed tools)
    expect(r.deniedTools).toEqual(["PowerShell"]);
  });

  it("033:FR-004: is_error or a subtype other than success is a failed turn, whatever the exit code", () => {
    expect(parseClaudeResult(withFields({ is_error: true, subtype: "error_during_execution" }))!.failed).toContain("error_during_execution");
    expect(parseClaudeResult(withFields({ subtype: "error_max_turns" }))!.failed).toContain("error_max_turns");
  });

  it("033:FR-004: no refused tools gives an empty list", () => {
    expect(parseClaudeResult(withFields({ permission_denials: [] }))!.deniedTools).toEqual([]);
  });

  it("033:FR-004: the result after other output lines is still found", () => {
    expect(parseClaudeResult(`a warning line\n${recorded}`)!.usage!.tokens).toBe(1547);
  });

  it("033:FR-004: output that holds no result object gives nothing, so the exit code decides as before", () => {
    expect(parseClaudeResult("")).toBeUndefined();
    expect(parseClaudeResult("Lane finished, T001 done.")).toBeUndefined();
    expect(parseClaudeResult('{"type":"system","subtype":"init"}')).toBeUndefined();
  });

  it("033:FR-004: usage falls back to the top-level usage object when modelUsage is absent", () => {
    const r = parseClaudeResult(JSON.stringify({ type: "result", subtype: "success", is_error: false, usage: { input_tokens: 5, output_tokens: 7 }, total_cost_usd: 0.01 }))!;
    expect(r.usage).toEqual({ tokens: 12, inputTokens: 5, outputTokens: 7, costUSD: 0.01 });
  });
});

/**
 * Headless runner registry (feature 028, FR-006, FR-007). A runner is *data*: the command that runs one
 * assistant non-interactively, how its exit reads and whether it reports token usage. Every entry starts
 * `verified: false`; a runner becomes runnable only after its command has run a real lane task on a live
 * install (T044, T045), and the matrix in `docs/tool-compatibility.md` carries the same rows (a doc-sync test
 * keeps them equal). `runnable()` is the single chokepoint before any process is spawned (SC-006, Principle 4).
 */

import { satisfies } from "../plugins/semver.js";
import { parseClaudeResult, type RunnerResult } from "./run-result.js";

export interface RunnerJob {
  /** The full prompt text (IDs, `@` references, ownership). */
  prompt: string;
  /** The same prompt as a file under the run directory, for runners that take a file reference. */
  promptFile: string;
  model?: string;
}

export interface RunnerCommand {
  exe: string;
  args: string[];
  /** Text written to the process's stdin; absent when the prompt is passed another way. */
  stdin?: string;
}

export interface RunnerSpec {
  /** Matches the assistant's id in `config.tools`. */
  id: string;
  label: string;
  executable: string;
  invoke(job: RunnerJob): RunnerCommand;
  /** How the process's exit is read, in words (recorded in the matrix). */
  exit: string;
  /** Whether the process reports token usage, so a token ceiling can be enforced. */
  reportsUsage: boolean;
  /**
   * Reads the process's captured stdout once it exits: usage and the signs of a failed turn. Absent for a runner whose
   * output is not read (its exit code and the task list decide, as in 1.6); `undefined` from it means the same.
   */
  readResult?: (stdout: string) => RunnerResult | undefined;
  verified: boolean;
  /** The CLI version the command was verified against; present only when `verified`. */
  verifiedVersion?: string;
  /**
   * Feature 033 (FR-004, C-3): the operating systems the live check was recorded on. A verified runner is runnable only
   * there. Absent on a runner written for 1.6, which carried no platform list (no platform restriction is applied).
   */
  verifiedOn?: NodeJS.Platform[];
  /** Feature 033: the assistant versions the record covers, as a semver range; a detected version outside it is unverified. */
  verifiedRange?: string;
  /** What is still to confirm on a live install. */
  toVerify: string;
}

/**
 * The Claude Code command (live check on Windows, claude 2.1.332): plain `claude -p` exits 0 having done nothing, because
 * every edit and shell command needs an approval nobody can give headless. `acceptEdits` allows file edits; the allowed
 * tools add only `ambykit` itself (the lane's status reports), on both shell tools Claude Code may pick (Bash, and
 * PowerShell on Windows); everything else stays denied. `--output-format json` ends the run with one JSON result that
 * carries usage, `is_error`, `subtype` and `permission_denials` (read by `src/core/run-result.ts`).
 */
export const CLAUDE_ALLOWED_TOOLS = "Bash(ambykit:*),PowerShell(ambykit:*)";

export const RUNNERS: RunnerSpec[] = [
  {
    id: "claude",
    label: "Claude Code",
    executable: "claude",
    invoke: (job) => ({
      exe: "claude",
      args: ["-p", "--permission-mode", "acceptEdits", "--allowedTools", CLAUDE_ALLOWED_TOOLS, "--output-format", "json", ...(job.model ? ["--model", job.model] : [])],
      stdin: job.prompt,
    }),
    exit: "0 = finished its turn; non-zero, an error result or refused tools with tasks left open = failed",
    reportsUsage: true,
    readResult: parseClaudeResult,
    verified: false,
    toVerify: "the permission flags let a lane edit its files and run `ambykit activity` (Bash and PowerShell), the JSON result's usage and failure fields, a failed turn's exit code",
  },
  {
    id: "codex",
    label: "Codex",
    executable: "codex",
    invoke: (job) => ({ exe: "codex", args: ["exec", ...(job.model ? ["--model", job.model] : []), "-"], stdin: job.prompt }),
    exit: "0 = finished; non-zero = failed",
    reportsUsage: false,
    verified: false,
    toVerify: "exec subcommand, prompt on stdin, sandbox and approval flags for edits, exit codes, usage output",
  },
];

export function runnerFor(id: string): RunnerSpec | undefined {
  return RUNNERS.find((r) => r.id === id);
}

export type Runnable = { ok: true; runner: RunnerSpec } | { ok: false; reason: string };

/** Where a runner would run: the operating system (default: this one) and, when known, the assistant's version. */
export interface RunnerEnv {
  platform?: NodeJS.Platform;
  version?: string;
}

/**
 * FR-006: only a verified runner is runnable; the reason says exactly why a refused one is not. Feature 033 (FR-004, FR-005):
 * a verified runner is also refused on a platform its record does not list, and for a known version outside its recorded range,
 * and the reason names which. The second argument is the registry (tests) or the environment; a version is checked only when given.
 */
export function runnable(id: string, registryOrEnv?: RunnerSpec[] | RunnerEnv, env?: RunnerEnv): Runnable {
  const registry = Array.isArray(registryOrEnv) ? registryOrEnv : RUNNERS;
  const where: RunnerEnv = (Array.isArray(registryOrEnv) ? env : registryOrEnv) ?? {};
  const platform = where.platform ?? process.platform;
  const runner = registry.find((r) => r.id === id);
  if (!runner) {
    const ok = registry.filter((r) => r.verified).map((r) => r.id);
    return { ok: false, reason: `no headless runner is recorded for '${id}'; runnable assistants: ${ok.join(", ") || "none yet"}` };
  }
  if (!runner.verified) {
    return { ok: false, reason: `the ${runner.label} runner is not verified yet (to confirm on a live install: ${runner.toVerify}); see docs/tool-compatibility.md` };
  }
  if (runner.verifiedOn && !runner.verifiedOn.includes(platform)) {
    return { ok: false, reason: `the ${runner.label} runner is unverified on this platform (${platform}); it was verified on ${runner.verifiedOn.join(", ")}` };
  }
  if (runner.verifiedRange && where.version !== undefined) {
    const inRange = satisfies(where.version, runner.verifiedRange);
    if (!inRange.supported || !inRange.satisfied) {
      return { ok: false, reason: `the ${runner.label} runner is unverified for version ${where.version}; it was verified for ${runner.verifiedRange}` };
    }
  }
  return { ok: true, runner };
}

export interface RunnerListing {
  id: string;
  label: string;
  verified: boolean;
  verifiedVersion?: string;
  /** Feature 033: where and for which versions the live check was recorded. */
  verifiedOn?: NodeJS.Platform[];
  verifiedRange?: string;
  reportsUsage: boolean;
  runnable: boolean;
  /** Present when not runnable. */
  reason?: string;
}

/** FR-007: the runners with their capabilities, for `ambykit run --runners`. */
export function listRunners(registry: RunnerSpec[] = RUNNERS, env: RunnerEnv = {}): RunnerListing[] {
  return registry.map((r) => {
    const can = runnable(r.id, registry, env);
    return {
      id: r.id,
      label: r.label,
      verified: r.verified,
      ...(r.verifiedVersion ? { verifiedVersion: r.verifiedVersion } : {}),
      ...(r.verifiedOn ? { verifiedOn: r.verifiedOn } : {}),
      ...(r.verifiedRange ? { verifiedRange: r.verifiedRange } : {}),
      reportsUsage: r.reportsUsage,
      runnable: can.ok,
      ...(can.ok ? {} : { reason: can.reason }),
    };
  });
}

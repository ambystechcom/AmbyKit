/**
 * Headless runner registry (feature 028, FR-006, FR-007). A runner is *data*: the command that runs one
 * assistant non-interactively, how its exit reads and whether it reports token usage. Every entry starts
 * `verified: false`; a runner becomes runnable only after its command has run a real lane task on a live
 * install (T044, T045), and the matrix in `docs/tool-compatibility.md` carries the same rows (a doc-sync test
 * keeps them equal). `runnable()` is the single chokepoint before any process is spawned (SC-006, Principle 4).
 */

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
  verified: boolean;
  /** The CLI version the command was verified against; present only when `verified`. */
  verifiedVersion?: string;
  /** What is still to confirm on a live install. */
  toVerify: string;
}

export const RUNNERS: RunnerSpec[] = [
  {
    id: "claude",
    label: "Claude Code",
    executable: "claude",
    invoke: (job) => ({ exe: "claude", args: ["-p", ...(job.model ? ["--model", job.model] : [])], stdin: job.prompt }),
    exit: "0 = finished its turn; non-zero = failed",
    reportsUsage: false,
    verified: false,
    toVerify: "non-interactive flag, prompt on stdin, permission handling for edits, exit codes, usage output",
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

/** FR-006: only a verified runner is runnable; the reason says exactly why a refused one is not. */
export function runnable(id: string, registry: RunnerSpec[] = RUNNERS): Runnable {
  const runner = registry.find((r) => r.id === id);
  if (!runner) {
    const ok = registry.filter((r) => r.verified).map((r) => r.id);
    return { ok: false, reason: `no headless runner is recorded for '${id}'; runnable assistants: ${ok.join(", ") || "none yet"}` };
  }
  if (!runner.verified) {
    return { ok: false, reason: `the ${runner.label} runner is not verified yet (to confirm on a live install: ${runner.toVerify}); see docs/tool-compatibility.md` };
  }
  return { ok: true, runner };
}

export interface RunnerListing {
  id: string;
  label: string;
  verified: boolean;
  verifiedVersion?: string;
  reportsUsage: boolean;
  runnable: boolean;
  /** Present when not runnable. */
  reason?: string;
}

/** FR-007: the runners with their capabilities, for `ambykit run --runners`. */
export function listRunners(registry: RunnerSpec[] = RUNNERS): RunnerListing[] {
  return registry.map((r) => {
    const can = runnable(r.id, registry);
    return {
      id: r.id,
      label: r.label,
      verified: r.verified,
      ...(r.verifiedVersion ? { verifiedVersion: r.verifiedVersion } : {}),
      reportsUsage: r.reportsUsage,
      runnable: can.ok,
      ...(can.ok ? {} : { reason: can.reason }),
    };
  });
}

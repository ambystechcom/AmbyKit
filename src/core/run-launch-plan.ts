import { RUNNERS, runnable, type RunnerSpec } from "./runners.js";

/**
 * The launch plan (feature 028, FR-001..FR-004, FR-006): lanes + their assistant + their prompt file → the
 * exact command per lane. Pure: it decides and formats, it starts nothing. A lane whose assistant has no
 * verified runner is `refused` with the reason, and the same plan feeds the preview, `--emit-script` and the
 * launch, so what is printed is exactly what runs.
 */

export interface LaunchLane {
  /** Short lane name `lane-p-k`. */
  lane: string;
  /** Full lane name `NNN-slug.lane-p-k`. */
  full: string;
  /** The lane's worktree. */
  cwd: string;
  assistant: string;
  /** The prompt text; the plan only names where it is stored. */
  prompt: string;
}

export interface LaunchEntry {
  lane: string;
  full: string;
  assistant: string;
  cwd: string;
  promptFile: string;
  prompt: string;
  /** Absent when refused. */
  command?: { exe: string; args: string[]; stdin?: string };
  /** The command as a person would type it, redirecting the prompt file where the runner reads stdin. */
  display: string;
  /** Why this lane will not run; set exactly when `command` is absent. */
  refused?: string;
}

export interface LaunchPlanOptions {
  /** Where a lane's prompt file lives (relative or absolute path as printed). */
  promptFileFor(lane: string): string;
  registry?: RunnerSpec[];
  model?: string;
  /** Shell commands a job may run besides `ambykit` (`fleet.allowedCommands`). */
  allowedCommands?: readonly string[];
}

const quote = (a: string): string => (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

export function launchPlan(lanes: LaunchLane[], opts: LaunchPlanOptions): LaunchEntry[] {
  const registry = opts.registry ?? RUNNERS;
  return lanes.map((l) => {
    const promptFile = opts.promptFileFor(l.lane);
    const base = { lane: l.lane, full: l.full, assistant: l.assistant, cwd: l.cwd, promptFile, prompt: l.prompt };
    const can = runnable(l.assistant, registry);
    if (!can.ok) return { ...base, display: `# ${l.lane} (${l.assistant}): REFUSED — ${can.reason}`, refused: can.reason };
    const command = can.runner.invoke({
      prompt: l.prompt,
      promptFile,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.allowedCommands ? { allowedCommands: opts.allowedCommands } : {}),
    });
    const text = [command.exe, ...command.args].map(quote).join(" ");
    const display = `cd ${quote(l.cwd)} && ${text}${command.stdin !== undefined ? ` < ${quote(promptFile)}` : ""}`;
    return { ...base, command, display };
  });
}

/** Lanes the plan refuses, with the reason each. */
export function refusals(plan: LaunchEntry[]): { lane: string; assistant: string; reason: string }[] {
  return plan.flatMap((e) => (e.refused ? [{ lane: e.lane, assistant: e.assistant, reason: e.refused }] : []));
}

/** Spread lanes over assistants round-robin, so two lanes and two assistants run on two different assistants. */
export function assignAssistants(lanes: string[], assistants: string[]): Map<string, string> {
  const out = new Map<string, string>();
  lanes.forEach((lane, i) => out.set(lane, assistants[i % assistants.length]!));
  return out;
}

import { featureBranch } from "../core/lane-merge.js";
import { LaneCommand } from "./lane.js";
import { WorktreeCommand } from "./worktree.js";

/**
 * Lane preparation for a fleet (feature 031, clarification C-2, risk R1). A feature the fleet runs needs its lanes
 * (`ambykit lane`); the fleet prepares missing ones with the lane command itself (so there is one lane planner,
 * 015's) and says so in the preview. When it cannot (no worktrees, no feature branch, path conflicts) it refuses
 * with the exact `ambykit lane` command to run by hand, never half-starts.
 */

export interface PrepareResult {
  feature: string;
  ok: boolean;
  /** Present when `ok` is false: why, with the command that fixes it. */
  reason?: string;
}

/** Runs one `ambykit lane` invocation and reports its exit code and error text. Replaceable in tests. */
export type LaneRunner = (cwd: string, positionals: string[], flags: Record<string, string | boolean>) => Promise<{ code: number; err: string }>;

/** The real runner: the lane command in-process, with its console output captured so the fleet's output stays its own. */
export const runLaneCommand: LaneRunner = async (cwd, positionals, flags) => {
  const err: string[] = [];
  const [log, error, warn] = [console.log, console.error, console.warn];
  console.log = () => undefined;
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await new LaneCommand().run({ cwd, positionals, flags });
    return { code, err: err.join("\n") };
  } finally {
    [console.log, console.error, console.warn] = [log, error, warn];
  }
};

/**
 * Give a feature its worktree when it has none (031 FR-013: each feature has its own worktree), with the worktree
 * command itself, so the fleet does not pause asking a person to run `ambykit worktree` (the 2.0 dogfood). A failure is
 * returned with the command to run by hand.
 */
export async function ensureFeatureWorktree(root: string, feature: string): Promise<{ ok: true; created: boolean } | { ok: false; reason: string }> {
  if (featureBranch(root, feature)?.checkout) return { ok: true, created: false };
  const err: string[] = [];
  const [log, error, warn] = [console.log, console.error, console.warn];
  console.log = () => undefined;
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  let code: number;
  try {
    code = await new WorktreeCommand().run({ cwd: root, positionals: [feature], flags: {} });
  } finally {
    [console.log, console.error, console.warn] = [log, error, warn];
  }
  if (code === 0 && featureBranch(root, feature)?.checkout) return { ok: true, created: true };
  const detail = err.find((l) => l.trim().length > 0) ?? "the worktree command failed";
  return { ok: false, reason: `${detail} Create it yourself with: ambykit worktree ${feature}` };
}

export async function prepareLanes(
  root: string,
  features: readonly { feature: string; lanes: number }[],
  run: LaneRunner = runLaneCommand,
): Promise<PrepareResult[]> {
  const out: PrepareResult[] = [];
  for (const f of features) {
    // `--next`: the feature's next stage, sequential tasks included (a feature's first tasks are often not [P])
    const r = await run(root, [f.feature], { lanes: String(f.lanes), next: true });
    if (r.code === 0) out.push({ feature: f.feature, ok: true });
    else {
      const detail = r.err.split("\n").find((l) => l.trim().length > 0) ?? "the lane command failed";
      out.push({ feature: f.feature, ok: false, reason: `${detail} Prepare the lanes yourself with: ambykit lane ${f.feature} --next --lanes=${f.lanes}` });
    }
  }
  return out;
}

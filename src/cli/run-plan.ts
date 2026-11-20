import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../core/spec-format/dispatch.js";
import type { FleetSettings } from "../core/config.js";
import { listRuns, runDir } from "../core/fleet/index.js";
import { assignAssistants, launchPlan, type LaunchEntry } from "../core/run-launch-plan.js";
import { buildLanePrompt } from "../core/run-prompt.js";
import { RUNNERS, type RunnerSpec } from "../core/runners.js";
import type { LaneRef } from "../core/query.js";
import { DIRECTIVE_PROTOCOL, REPORT_CADENCE } from "../mcp/tools/fleet.js";

/** The protocol wording spec 019's worker persona carries; one source (025), so the two cannot drift. */
export const PROTOCOL = `${REPORT_CADENCE} ${DIRECTIVE_PROTOCOL}`;

/** The id the next run of a feature will get: one past the highest existing number (025's rule). */
export function nextRunId(root: string, feature: string): string {
  const nums = listRuns(root, feature).map((r) => Number(r.run.slice(r.run.lastIndexOf(".") + 1)));
  return `${feature}.${Math.max(0, ...nums) + 1}`;
}

/** Task IDs a lane still has to do, read from the lane's own checkout. */
export function laneOpenTasks(lane: LaneRef): string[] {
  const file = join(lane.root, "specs", lane.manifest.feature, "tasks.md");
  if (!existsSync(file)) return lane.manifest.tasks.map((t) => t.id);
  const done = new Set(readTasks(readFileSync(file, "utf8")).tasks.filter((t) => t.done).map((t) => t.id));
  return lane.manifest.tasks.map((t) => t.id).filter((id) => !done.has(id));
}

/** The artifacts that exist in the lane checkout, as `@` reference targets. */
export function laneArtifacts(lane: LaneRef): string[] {
  const dir = `specs/${lane.manifest.feature}`;
  return ["spec.md", "plan.md", "tasks.md", "tests.md"].map((f) => `${dir}/${f}`).filter((p) => existsSync(join(lane.root, p)));
}

export interface PlanContext {
  root: string;
  feature: string;
  lanes: LaneRef[];
  assistants: string[];
  run: string;
  settings: FleetSettings;
  registry?: RunnerSpec[];
  /** Run in the preview and script paths: where prompt files will be, even when nothing is written yet. */
  promptDir?: string;
  /** Lane (short) -> assistant, fixed by an earlier session of the same run (`--continue-run`). */
  assignment?: Map<string, string>;
}

export function lanePromptText(lane: LaneRef, run: string, open?: string[], findings?: string[], runDir?: string): string {
  return buildLanePrompt(
    { feature: lane.manifest.feature, lane: lane.name, phase: lane.manifest.phase, tasks: lane.manifest.tasks },
    { run, artifacts: laneArtifacts(lane), open: open ?? laneOpenTasks(lane), ...(findings ? { findings } : {}), protocol: PROTOCOL, ...(runDir ? { runDir } : {}) },
  );
}

/** One plan used by the preview, `--emit-script` and the launch: what is printed is exactly what runs. */
export function buildLaunchPlan(ctx: PlanContext): LaunchEntry[] {
  const assign = ctx.assignment ?? assignAssistants(ctx.lanes.map((l) => l.short), ctx.assistants.length > 0 ? ctx.assistants : ["claude"]);
  const promptDir = ctx.promptDir ?? join(runDir(ctx.root, ctx.run), "prompts");
  const lanes = ctx.lanes.map((l) => ({
    lane: l.short,
    full: l.name,
    cwd: l.root,
    assistant: assign.get(l.short) ?? ctx.assistants[0] ?? "claude",
    prompt: lanePromptText(l, ctx.run),
  }));
  return launchPlan(lanes, {
    promptFileFor: (lane) => join(promptDir, `${lane}.md`),
    registry: ctx.registry ?? RUNNERS,
    ...(ctx.settings.workerModel ? { model: ctx.settings.workerModel } : {}),
  });
}

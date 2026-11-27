import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isLastStageOfPhase } from "../core/lanes.js";
import { readPhases, readTasks } from "../core/spec-format/dispatch.js";
import { runDir, verdictPath } from "../core/fleet/index.js";
import { buildRolePrompt } from "../core/run-prompt.js";
import { laneArtifacts } from "./run-plan.js";
import type { JobKind, LaneRuntime, Session } from "./run-session.js";

/** The lane phase's `**Verify:**` line as written in the lane's own tasks.md; undefined when it has none. */
export function laneVerifyLine(rt: LaneRuntime): string | undefined {
  const file = join(rt.ref.root, "specs", rt.ref.manifest.feature, "tasks.md");
  if (!existsSync(file)) return undefined;
  const phase = readPhases(readFileSync(file, "utf8")).find((p) => p.phase === rt.ref.manifest.phase);
  return phase?.check ? `**Verify:** ${phase.check}` : undefined;
}

/**
 * Is this lane its phase's last stage? Read from the lane's own tasks.md (see `isLastStageOfPhase`); true when the file
 * cannot be read, so a lane without one keeps the old rule (the phase's Verify line applies).
 */
export function laneIsLastStage(rt: LaneRuntime): boolean {
  const file = join(rt.ref.root, "specs", rt.ref.manifest.feature, "tasks.md");
  if (!existsSync(file)) return true;
  const tasks = readTasks(readFileSync(file, "utf8")).tasks;
  return isLastStageOfPhase(tasks, rt.ref.manifest.tasks.map((t) => t.id), rt.ref.manifest.phase);
}

/** Where a reviewer writes its verdict, relative to the run directory (spec 019's contract). */
export function verdictFile(rt: LaneRuntime, role: "qa" | "architect", round: number): string {
  return verdictPath(rt.file.lane, role, round);
}

/** The run directory as an absolute path with forward slashes, for prompts that run in a lane's checkout. */
export function absoluteRunDir(s: Session): string {
  return runDir(s.root, s.run).replace(/\\/g, "/");
}

/**
 * The QA or architect job's prompt: the role by `@` reference, the phase's Verify line (only on the phase's last stage;
 * an earlier stage is judged on its own tasks), the verdict file.
 */
export function rolePromptText(s: Session, rt: LaneRuntime, job: JobKind): string {
  const role = job === "architect" ? "architect" : "qa";
  const last = laneIsLastStage(rt);
  const verify = last ? laneVerifyLine(rt) : undefined;
  return buildRolePrompt({
    role,
    feature: rt.ref.manifest.feature,
    lane: rt.ref.name,
    phase: rt.ref.manifest.phase,
    round: rt.round,
    run: s.run,
    roleFile: `.amby/roles/${role}.md`,
    ...(verify ? { verify } : {}),
    ...(last ? {} : { stageTasks: rt.ref.manifest.tasks.map((t) => t.id) }),
    artifacts: laneArtifacts(rt.ref),
    verdictFile: verdictFile(rt, role, rt.round),
    // absolute: the reviewer runs in the lane's checkout, but the supervisor reads the run directory of the project root
    runDir: absoluteRunDir(s),
  });
}

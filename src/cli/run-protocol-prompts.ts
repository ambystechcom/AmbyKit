import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readPhases } from "../core/spec-format/dispatch.js";
import { verdictPath } from "../core/fleet/index.js";
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

/** Where a reviewer writes its verdict, relative to the run directory (spec 019's contract). */
export function verdictFile(rt: LaneRuntime, role: "qa" | "architect", round: number): string {
  return verdictPath(rt.file.lane, role, round);
}

/** The QA or architect job's prompt: the role by `@` reference, the phase's Verify line, the verdict file. */
export function rolePromptText(s: Session, rt: LaneRuntime, job: JobKind): string {
  const role = job === "architect" ? "architect" : "qa";
  const verify = laneVerifyLine(rt);
  return buildRolePrompt({
    role,
    feature: rt.ref.manifest.feature,
    lane: rt.ref.name,
    phase: rt.ref.manifest.phase,
    round: rt.round,
    run: s.run,
    roleFile: `.amby/roles/${role}.md`,
    ...(verify ? { verify } : {}),
    artifacts: laneArtifacts(rt.ref),
    verdictFile: verdictFile(rt, role, rt.round),
  });
}

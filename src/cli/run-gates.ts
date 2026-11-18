import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readRun } from "../core/fleet/index.js";
import { readTasks } from "../core/spec-format/dispatch.js";
import { featureBranch } from "../core/lane-merge.js";
import { approveGate, completedStories, escalate, lastDecision, openGate, phaseGateId } from "../core/run-gate-actions.js";
import { event, type Session } from "./run-session.js";

/**
 * Gates (feature 028, FR-015): after a prepared set has merged, a completed user-story checkpoint waits for a
 * person before the next set starts. The state is `gates[]` in `run.json`; the loop only *reads* it (and, when
 * unattended, approves it as `unattended`). `approveGate` / `rejectGate` in `core/run-gate-actions.ts` are the
 * one pair of writers, shared with `ambykit run approve|reject` and the dashboard.
 */

export type GateOutcome =
  | { kind: "advance" }
  | { kind: "wait"; gate: string; stories: string[] }
  | { kind: "rejected"; gate: string; reason?: string }
  /** Non-[P] tasks of the finished phase still need a person (they are not run headless in 1.6). */
  | { kind: "stays"; tasks: string[] };

/** The feature's tasks as merged on its branch (the lane merges tick them here). */
function featureTasks(s: Session) {
  const fb = featureBranch(s.root, s.feature);
  const file = fb?.checkout ? join(fb.checkout, "specs", s.feature, "tasks.md") : join(s.root, "specs", s.feature, "tasks.md");
  return existsSync(file) ? readTasks(readFileSync(file, "utf8")).tasks : [];
}

/** Decide what follows a phase whose lanes have all merged. */
export function afterPhase(s: Session, phase: number): GateOutcome {
  const tasks = featureTasks(s);
  const stays = tasks.filter((t) => t.phase === phase && !t.parallel && !t.done).map((t) => t.id);
  if (stays.length > 0) {
    escalate(s.root, s.run, { kind: "stays", phase, tasks: stays });
    return { kind: "stays", tasks: stays };
  }
  const stories = completedStories(tasks, phase);
  if (stories.length === 0) return { kind: "advance" };

  const id = phaseGateId(phase);
  const rec = readRun(s.root, s.run);
  const gate = rec?.gates.find((g) => g.id === id);
  if (gate?.state === "approved") return { kind: "advance" };
  if (!gate) {
    openGate(s.root, s.run, phase, stories);
    event(s, "gate-opened", undefined, `${id} after ${stories.join(", ")}`);
    s.say(`Checkpoint ${id}: ${stories.join(", ")} complete. Waiting for approval: ambykit run approve ${s.run}`);
  }
  if (s.unattended) {
    approveGate(s.root, s.run, { gate: id, by: "unattended", reason: "unattended mode" });
    event(s, "gate-approved", undefined, `${id} (unattended)`);
    return { kind: "advance" };
  }
  const after = rec ? lastDecision(rec, id) : null;
  if (after?.decision === "rejected") return { kind: "rejected", gate: id, ...(after.reason ? { reason: after.reason } : {}) };
  return { kind: "wait", gate: id, stories };
}

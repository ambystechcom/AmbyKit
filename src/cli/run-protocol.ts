import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseVerdict, readRun, runDir, updateRun } from "../core/fleet/index.js";
import { escalate } from "../core/run-gate-actions.js";
import { reviewStep } from "../core/run-review.js";
import { addTaskEvents } from "./run-budget.js";
import { startJob } from "./run-launch.js";
import { verdictFile } from "./run-protocol-prompts.js";
import { event, isRunning, save, type LaneRuntime, type Session } from "./run-session.js";

/**
 * The team protocol as processes (feature 028, FR-018): the same QA, architect and review loop `/amby.run`
 * runs at prompt level, with each reviewer launched as a process of the lane's own assistant. A finished lane
 * is reviewed by QA, then the architect; either one's failure goes back to the *same lane's worker* as finding
 * IDs only; after `fleet.roundLimit` failed rounds the loop stops and asks a person. Only a lane that passes
 * both becomes `ready` to merge, so a failing Verify line can never reach the merger (SC-009).
 */

/** Move every finished or reviewing lane one step along the loop. */
export function advanceReviews(s: Session, review: boolean): void {
  for (const rt of s.lanes) {
    if (rt.file.status === "finished") {
      if (!review) {
        rt.file.status = "ready";
        save(s, rt);
        continue;
      }
      rt.stage = "qa";
      rt.round = rt.round || 1;
      begin(s, rt);
    } else if (rt.file.status === "reviewing" && rt.job !== "worker" && !isRunning(s, rt) && rt.exit) {
      judge(s, rt);
    }
  }
}

function begin(s: Session, rt: LaneRuntime): void {
  recordStage(s, rt);
  if (!startJob(s, rt, rt.stage ?? "qa")) return;
  event(s, "review-started", rt, `${rt.stage} round ${rt.round}`);
}

function recordStage(s: Session, rt: LaneRuntime): void {
  if (!readRun(s.root, s.run)) return;
  updateRun(s.root, s.run, { stage: rt.stage ?? "working", round: rt.round });
}

function judge(s: Session, rt: LaneRuntime): void {
  if (s.stopReason) {
    // the reviewer was stopped, not finished: review this lane again when the run is continued
    delete rt.exit;
    delete rt.handle;
    delete rt.file.pid;
    rt.file.status = "finished";
    save(s, rt);
    return;
  }
  const role = rt.stage ?? "qa";
  const limit = readRun(s.root, s.run)?.limit || s.settings.roundLimit;
  const path = join(runDir(s.root, s.run), verdictFile(rt, role, rt.round));
  const verdict = existsSync(path) ? parseVerdict(readFileSync(path, "utf8")) : null;
  const step = reviewStep({ stage: role, round: rt.round, failedRounds: rt.file.failedRounds ?? 0, limit, reviewerDone: true, verdict });
  delete rt.exit;
  delete rt.handle;
  delete rt.file.pid;
  if (step.kind === "advance") {
    rt.stage = "architect";
    event(s, "review-passed", rt, `${role} round ${rt.round}`);
    begin(s, rt);
  } else if (step.kind === "pass") {
    rt.file.status = "ready";
    delete rt.stage;
    save(s, rt);
    recordStage(s, rt);
    event(s, "review-passed", rt, `${role} round ${rt.round}; ready to merge`);
    s.say(`${rt.file.lane}: reviews passed`);
  } else if (step.kind === "fix") {
    rt.file.failedRounds = step.failedRounds;
    rt.pendingFindings = step.findings;
    rt.round += 1;
    rt.stage = "qa";
    rt.file.status = "queued";
    save(s, rt);
    addTaskEvents(s, 1);
    event(s, "review-failed", rt, `${role} found ${step.findings.join(", ")}; sent back to the worker`);
    s.say(`${rt.file.lane}: ${role} review failed (${step.findings.join(", ")}); back to the worker`);
  } else if (step.kind === "escalate") {
    rt.file.status = "escalated";
    rt.file.failedRounds = step.failedRounds;
    rt.file.reason = step.reason;
    save(s, rt);
    escalate(s.root, s.run, { kind: "review", lane: rt.file.lane, reason: step.reason, findings: step.findings, rounds: step.failedRounds });
    event(s, "escalated", rt, step.reason);
    s.say(`${rt.file.lane}: ${step.reason}. A person decides.`);
  }
}

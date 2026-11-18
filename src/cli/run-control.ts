import { laneStatus, readDirective, readRun, updateRun, writeDirective } from "../core/fleet/index.js";
import { reassignGate } from "../core/run-supervise.js";
import { runnable } from "../core/runners.js";
import { isFailed } from "../core/query.js";
import { event, isRunning, save, type Session } from "./run-session.js";

/**
 * Directives (feature 028, FR-016). A person pauses, resumes or stops a lane from any host (`ambykit
 * directive`, the dashboard, `/amby.run`); the only writer is spec 025's `writeDirective`, and this module only
 * *reads* them (through `laneStatus` and `readDirective`). A worker finishes its current task and obeys at its
 * next report; the run records when it did. A paused lane's process ends (it does not start another task); a
 * `continue` written after the pause puts the lane back in the queue. Nothing here sends a signal: a directive
 * is advice a worker follows, and only the stop grace (in the supervisor) terminates a lane that ignores it.
 */

/** Apply each lane's directive to its supervision state. Call once per tick. */
export function applyDirectives(s: Session): void {
  for (const rt of s.lanes) {
    const directive = readDirective(s.root, s.run, rt.file.lane);
    if (!directive) continue;
    const st = laneStatus(s.root, { feature: s.feature, lane: rt.file.lane, run: s.run, now: s.now() });
    const status = isFailed(st) ? "none" : st.directive.status;
    const running = isRunning(s, rt);

    if (directive.action === "pause" || directive.action === "stop") {
      if (rt.stopAskedMs === undefined && directive.action === "stop") rt.stopAskedMs = Date.parse(directive.at);
      // Recorded once per directive: the worker obeyed (it reported paused, or its process ended).
      const obeyed = status === "paused" || status === "obeyed" || (!running && rt.file.status !== "queued");
      if (obeyed && rt.obeyedAt !== directive.at) {
        rt.obeyedAt = directive.at;
        event(s, "obeyed", rt, directive.action);
        s.say(`${rt.file.lane}: obeyed ${directive.action}`);
      }
      if (!running && (rt.file.status === "running" || rt.file.status === "queued")) {
        // the process is gone (or never started): a paused or stopped lane is not "unfinished"
        rt.file.status = directive.action === "stop" ? "stopped" : "paused";
        rt.file.pausedAt = directive.at;
        save(s, rt);
      }
      continue;
    }

    // continue: a lane paused earlier than this directive goes back in the queue (no restart is counted). A
    // lane whose review never converged (`escalated`) is a person's decision too: `resume` gives it a fresh
    // set of review rounds.
    const waiting = rt.file.status === "paused" || rt.file.status === "escalated";
    if (waiting && (!rt.file.pausedAt || Date.parse(directive.at) > Date.parse(rt.file.pausedAt))) {
      if (rt.file.status === "escalated") {
        rt.file.failedRounds = 0;
        rt.round = 1;
      }
      rt.file.status = "queued";
      delete rt.file.reason;
      delete rt.file.pausedAt;
      save(s, rt);
      event(s, "resumed", rt, "continue directive");
      s.say(`${rt.file.lane}: resumed`);
    }
  }
}

/**
 * `--continue-run` (FR-016, SC-005): bring a run back from where it stopped. Lanes that were stopped (a budget,
 * a stop directive), ended with tasks open, failed to start, or were running when the supervisor died go back
 * in the queue; a lane whose process is still alive from the earlier session is adopted as it is. Lanes
 * waiting for a person (paused, merge conflict, escalated review) stay as they are. A `continue` directive is
 * written (through spec 025's writer) for any lane that still carries a pause or stop, so the first tick does
 * not obey a stale one. The prompt of a restarted lane lists only unchecked tasks, so no completed task repeats.
 */
export function reviveForContinue(s: Session): string[] {
  const revived: string[] = [];
  for (const rt of s.lanes) {
    const st = rt.file.status;
    const alive = rt.file.pid !== undefined && s.port.isAlive(rt.file.pid);
    const requeue = st === "stopped" || st === "unfinished" || st === "failed" || ((st === "running" || st === "reviewing") && !alive);
    if (!requeue) continue;
    rt.file.status = "queued";
    delete rt.file.reason;
    delete rt.file.pid;
    delete rt.file.pausedAt;
    delete rt.stopAskedMs;
    save(s, rt);
    const d = readDirective(s.root, s.run, rt.file.lane);
    if (d && d.action !== "continue") writeDirective(s.root, { feature: s.feature, lane: rt.file.lane, action: "continue", run: s.run, now: new Date(s.now()) });
    event(s, "revived", rt, `was ${st}`);
    revived.push(rt.file.lane);
  }
  return revived;
}

/**
 * FR-009: a lane moves to a different assistant only when a person approved it. A paused lane with a
 * `reassign` approval newer than its pause goes back in the queue on the approved assistant (if that assistant
 * has a verified runner), with its restarts reset. Without an approval nothing here ever changes an assistant.
 */
export function applyReassignments(s: Session): void {
  const rec = readRun(s.root, s.run);
  if (!rec) return;
  for (const rt of s.lanes) {
    if (rt.file.status !== "paused") continue;
    const approval = [...rec.approvals]
      .reverse()
      .map((a) => a as { kind?: string; lane?: string; to?: string; at?: string } | null)
      .find((a) => a?.kind === "reassign" && a.lane === rt.file.lane && a.to && a.at && (!rt.file.pausedAt || Date.parse(a.at) > Date.parse(rt.file.pausedAt)));
    if (!approval?.to) continue;
    const gate = reassignGate(rec.approvals, rt.file.lane, approval.to);
    if (!gate.allowed) continue;
    const can = runnable(approval.to, s.registry);
    if (!can.ok) {
      s.say(`${rt.file.lane}: cannot move to ${approval.to}: ${can.reason}`);
      continue;
    }
    const from = rt.assistant;
    rt.assistant = approval.to;
    rt.file.assistant = approval.to;
    rt.file.restarts = 0;
    rt.file.status = "queued";
    delete rt.file.reason;
    delete rt.file.pausedAt;
    save(s, rt);
    const lanes = rec.lanes.map((l) => (l.lane === rt.ref.name ? { ...l, assistant: approval.to!, restarts: 0 } : l));
    updateRun(s.root, s.run, { lanes, status: "active", needsDecision: false });
    event(s, "reassigned", rt, `${from} to ${approval.to}, approved by a person`);
    s.say(`${rt.file.lane}: moved from ${from} to ${approval.to} (approved)`);
  }
}

/** Lanes a person has paused or stopped that have not started: they must not launch. */
export function heldByDirective(s: Session): Set<string> {
  const held = new Set<string>();
  for (const rt of s.lanes) {
    const d = readDirective(s.root, s.run, rt.file.lane);
    if (d && (d.action === "pause" || d.action === "stop")) held.add(rt.file.lane);
  }
  return held;
}

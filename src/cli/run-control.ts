import { laneStatus, readDirective } from "../core/fleet/index.js";
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

    // continue: a lane paused earlier than this directive goes back in the queue (no restart is counted)
    if (rt.file.status === "paused" && (!rt.file.pausedAt || Date.parse(directive.at) > Date.parse(rt.file.pausedAt))) {
      rt.file.status = "queued";
      delete rt.file.reason;
      delete rt.file.pausedAt;
      save(s, rt);
      event(s, "resumed", rt, "continue directive");
      s.say(`${rt.file.lane}: resumed`);
    }
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

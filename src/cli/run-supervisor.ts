import { laneStatus, readRun, updateRun, type RunLane } from "../core/fleet/index.js";
import { isFailed } from "../core/query.js";
import { escalate } from "../core/run-gate-actions.js";
import { isImmediateFailure, mustTerminate, restartDecision } from "../core/run-supervise.js";
import { startJob } from "./run-launch.js";
import { laneOpenTasks } from "./run-plan.js";
import { event, isRunning, save, stopProcess, type LaneRuntime, type Session } from "./run-session.js";
import { addTaskEvents } from "./run-budget.js";

/**
 * The supervisor (feature 028, FR-008..FR-010): what happens when a lane's process ends, and when it goes
 * quiet. *Whether a lane is stalled* is spec 025's `laneStatus`: no report and no `tasks.md` change for
 * `fleet.stallMinutes`, with waiting, blocked, paused and done lanes exempt. 028 keeps no stall logic of its
 * own; it only restarts (work preserved: the prompt lists the unchecked tasks) or pauses at the limit.
 */

/** Record how a worker's process ended: finished, unfinished, or failed at once (a command mismatch). */
export function collectExits(s: Session): void {
  for (const rt of s.lanes) {
    if (rt.job !== "worker" || rt.file.status !== "running" || !rt.exit || rt.exitedMs === undefined) continue;
    const exit = rt.exit;
    const ranMs = rt.exitedMs - (rt.startedMs ?? rt.exitedMs);
    rt.file.exit = { code: exit.code, signal: exit.signal };
    rt.file.exitedAt = new Date(rt.exitedMs).toISOString();
    delete rt.handle;
    delete rt.file.pid;
    const open = laneOpenTasks(rt.ref);
    if (open.length === 0) {
      rt.file.status = "finished";
      rt.round = rt.round || 1;
      event(s, "finished", rt, "every task is checked off");
      s.say(`${rt.file.lane}: finished`);
    } else if (rt.stopAskedMs !== undefined) {
      // asked to stop (a directive or a budget): the exit is the obeying, not a failure
      rt.file.status = "stopped";
      event(s, "stopped", rt, `${open.length} task(s) left open`);
    } else if (isImmediateFailure({ code: exit.code, ranMs })) {
      rt.file.status = "failed";
      rt.file.reason = `the ${rt.assistant} command exited at once with code ${exit.code ?? "none"}; its recorded command may no longer match the installed version (see docs/tool-compatibility.md)`;
      event(s, "failed", rt, rt.file.reason);
      s.say(`${rt.file.lane}: ${rt.file.reason}`);
    } else {
      rt.file.status = "unfinished";
      rt.file.reason = `the process ended with ${open.length} task(s) still open: ${open.join(", ")}`;
      event(s, "unfinished", rt, rt.file.reason);
      s.say(`${rt.file.lane}: ${rt.file.reason}. It will not be merged.`);
    }
    save(s, rt);
  }
}

/** Detect stalled workers and restart them or pause them at the restart limit (FR-008, FR-009, FR-010). */
export function superviseStalls(s: Session): void {
  for (const rt of s.lanes) {
    if (rt.job !== "worker" || rt.file.status !== "running" || !isRunning(s, rt)) continue;
    if (rt.stopAskedMs !== undefined) continue; // stopping: the stop grace handles it
    const st = laneStatus(s.root, { feature: s.feature, lane: rt.file.lane, run: s.run, now: s.now() });
    if (isFailed(st)) continue;
    const decision = restartDecision({ stalled: st.stalled, restarts: rt.file.restarts, limit: s.settings.restartLimit });
    if (decision === "none") continue;
    stopProcess(s, rt, "SIGTERM");
    if (decision === "restart") {
      rt.file.restarts += 1;
      syncRunLane(s, rt);
      addTaskEvents(s, 1);
      event(s, "stalled", rt, `no report or task change for ${st.idleMinutes ?? "?"} minutes; restart ${rt.file.restarts} of ${s.settings.restartLimit}`);
      s.say(`${rt.file.lane}: stalled (${st.idleMinutes ?? "?"} min); restarting (${rt.file.restarts} of ${s.settings.restartLimit})`);
      startJob(s, rt, "worker", { restart: true });
    } else {
      rt.file.status = "paused";
      rt.file.pausedAt = new Date(s.now()).toISOString();
      rt.file.reason = `stalled again after ${rt.file.restarts} restarts; a person must decide`;
      delete rt.handle;
      delete rt.file.pid;
      save(s, rt);
      escalate(s.root, s.run, { kind: "restart-limit", lane: rt.file.lane, assistant: rt.assistant, restarts: rt.file.restarts });
      event(s, "paused", rt, rt.file.reason);
      s.say(`${rt.file.lane}: ${rt.file.reason}. Resume it with: ambykit directive ${s.feature} ${rt.file.lane} resume`);
    }
  }
}

/** Keep spec 025's `lanes[].restarts` equal to the lane file's (the run record is what other hosts read). */
export function syncRunLane(s: Session, rt: LaneRuntime): void {
  const rec = readRun(s.root, s.run);
  if (!rec) return;
  const lanes: RunLane[] = rec.lanes.map((l) => (l.lane === rt.ref.name ? { ...l, restarts: rt.file.restarts } : l));
  updateRun(s.root, s.run, { lanes });
}

/** After a stop was asked for, terminate a lane that still has not reported once the stop grace is over. */
export function enforceStopGrace(s: Session): void {
  for (const rt of s.lanes) {
    if (rt.stopAskedMs === undefined || !isRunning(s, rt)) continue;
    const st = laneStatus(s.root, { feature: s.feature, lane: rt.file.lane, run: s.run, now: s.now() });
    const last = !isFailed(st) && st.lastReportAt ? Date.parse(st.lastReportAt) : null;
    if (mustTerminate({ stopRequestedAt: rt.stopAskedMs, lastReportAt: last, now: s.now(), graceMinutes: s.settings.stopGraceMinutes })) {
      stopProcess(s, rt, "SIGTERM");
      event(s, "terminated", rt, `no report within the ${s.settings.stopGraceMinutes}-minute stop grace`);
      s.say(`${rt.file.lane}: terminated after the stop grace`);
    }
  }
}

/**
 * A process from an earlier session (`--continue-run`) has no handle to tell us how it ended. When its pid is
 * gone, record an exit with no code so the normal rules classify it (finished, or unfinished with tasks open).
 */
export function noteAdoptedExits(s: Session): void {
  for (const rt of s.lanes) {
    if (rt.handle || rt.exit || (rt.file.status !== "running" && rt.file.status !== "reviewing")) continue;
    if (rt.file.pid === undefined || s.port.isAlive(rt.file.pid)) continue;
    rt.exit = { code: null, signal: null };
    rt.exitedMs = s.now();
    rt.startedMs ??= rt.exitedMs - 60_000; // unknown start: never read as an immediate failure
  }
}

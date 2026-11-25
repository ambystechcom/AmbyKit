import { writeDirective, readRun, updateRun, releaseTaskClaims } from "../core/fleet/index.js";
import { budgetDecision } from "../core/run-supervise.js";
import { laneOpenTasks } from "./run-plan.js";
import { readBudget, writeBudget } from "./run-files.js";
import { event, isRunning, stopProcess, type Session } from "./run-session.js";

/**
 * Budgets (feature 028, FR-013, FR-014). Wall-clock and task count are always enforced; a token ceiling only
 * where every runner reports usage, and the run says so when it cannot be. Exceeding a budget stops launching,
 * writes a `stop` directive for each running lane (through spec 025's single writer), records why in the run
 * state, and terminates a lane that has not reported once the stop grace is over.
 */

/** Count restarts and fix rounds as task events: the budget has room for rework (default 2 × open tasks). */
export function addTaskEvents(s: Session, n: number): void {
  const b = readBudget(s.root, s.run);
  writeBudget(s.root, s.run, { ...b, tasksUsed: b.tasksUsed + n });
}

/** Add the tokens a runner reported for one process (033: the claude runner's JSON result), so a token ceiling holds. */
export function addTokens(s: Session, n: number): void {
  if (!(n > 0)) return;
  const b = readBudget(s.root, s.run);
  writeBudget(s.root, s.run, { ...b, tokensUsed: (b.tokensUsed ?? 0) + n });
}

/**
 * Advance the meter: add elapsed time, count newly checked tasks once (a continued run does not count them
 * again) and release their claims (spec 025: claims are advisory and end at check-off).
 */
export function meter(s: Session, dtMs: number): void {
  const b = readBudget(s.root, s.run);
  const counted = new Set(b.counted);
  let added = 0;
  for (const rt of s.lanes) {
    const open = new Set(laneOpenTasks(rt.ref));
    for (const t of rt.ref.manifest.tasks) {
      if (open.has(t.id) || counted.has(`${rt.ref.name}:${t.id}`)) continue;
      counted.add(`${rt.ref.name}:${t.id}`);
      added += 1;
      releaseTaskClaims(s.root, s.feature, t.id);
    }
  }
  writeBudget(s.root, s.run, { ...b, elapsedMs: b.elapsedMs + Math.max(0, dtMs), tasksUsed: b.tasksUsed + added, counted: [...counted] });
}

/** Check the budgets; on the first overrun, begin the stop. Returns the reason once, then `undefined`. */
export function enforceBudgets(s: Session): string | undefined {
  if (s.stopReason) return undefined;
  const b = readBudget(s.root, s.run);
  const d = budgetDecision(s.budgets, {
    elapsedMs: b.elapsedMs,
    tasksUsed: b.tasksUsed,
    reportsUsage: s.reportsUsage,
    ...(b.tokensUsed !== undefined ? { tokensUsed: b.tokensUsed } : {}),
  });
  if (!d.exceeded || !d.reason) return undefined;
  const note = d.unenforced.length > 0 ? ` (${d.unenforced.join("; ")})` : "";
  s.say(`Budget exceeded: ${d.reason}${note}. Stopping the run: no new lanes start and running lanes are asked to stop.`);
  beginStop(s, d.reason, d.unenforced);
  return d.reason;
}

/**
 * Begin a budget stop: nothing new launches, running lanes get a `stop` directive through 025's writer and the run
 * is recorded as paused with the reason. Shared by the run's own budgets and by a fleet's (feature 031, FR-011).
 */
export function beginStop(s: Session, reason: string, unenforced: string[] = []): void {
  if (s.stopReason) return;
  s.stopReason = reason;
  event(s, "budget-exceeded", undefined, reason);
  for (const rt of s.lanes) {
    if (!isRunning(s, rt)) continue;
    rt.stopAskedMs = s.now();
    writeDirective(s.root, { feature: s.feature, lane: rt.file.lane, action: "stop", run: s.run, now: new Date(s.now()) });
  }
  const rec = readRun(s.root, s.run);
  if (rec) {
    updateRun(s.root, s.run, {
      status: "paused",
      escalations: [...rec.escalations, { kind: "budget", reason, unenforced, at: new Date(s.now()).toISOString() }],
    });
  }
}

/** Terminate every running lane (used when a budget stop has run out its grace, and on interrupt). */
export function stopAll(s: Session, signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): void {
  for (const rt of s.lanes) if (isRunning(s, rt)) stopProcess(s, rt, signal);
}

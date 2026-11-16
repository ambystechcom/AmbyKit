/**
 * Pure supervision rules (feature 028, FR-008..FR-010, FR-013, FR-014). Each takes a snapshot and returns a
 * decision; none touches a process, a file or the clock. *Whether a lane is stalled* is spec 025's
 * `laneStatus` (waiting, blocked, paused and done lanes are exempt there); 028 only decides what to do about it.
 */

export type RestartDecision = "none" | "restart" | "pause";

/** A stalled lane restarts until `limit` restarts are used; the next stall pauses it for a person (FR-009). */
export function restartDecision(input: { stalled: boolean; restarts: number; limit: number }): RestartDecision {
  if (!input.stalled) return "none";
  return input.restarts < input.limit ? "restart" : "pause";
}

/** A person's approval to move a lane to another assistant, recorded in `run.json` `approvals[]`. */
export interface ReassignApproval {
  kind: "reassign";
  lane: string;
  to: string;
  at: string;
}

export type ReassignDecision = { allowed: true } | { allowed: false; reason: string };

/** FR-009: a lane moves to a different assistant only with that person's approval; never on its own. */
export function reassignGate(approvals: unknown[], lane: string, to: string): ReassignDecision {
  const ok = approvals.some((a) => {
    const r = a as Partial<ReassignApproval> | null;
    return !!r && r.kind === "reassign" && r.lane === lane && r.to === to;
  });
  return ok ? { allowed: true } : { allowed: false, reason: `moving ${lane} to ${to} needs a person's approval; none is recorded` };
}

// --- budgets (FR-013, FR-014) -----------------------------------------------------

export interface Budgets {
  /** Minutes the run may take. Always enforced. */
  wallClockMinutes: number;
  /** Task events (check-offs plus restarts and fix rounds) the run may use. Always enforced. */
  maxTasks: number;
  /** Tokens, enforced only where every runner in the run reports usage. */
  maxTokens?: number;
}

export const DEFAULT_WALL_CLOCK_MINUTES = 120;

/** Defaults: 120 minutes, and twice the open tasks of the prepared lanes (room for rework). Config, then flags. */
export function resolveBudgets(input: { openTasks: number; config?: Record<string, number>; flags?: Partial<Budgets> }): Budgets {
  const c = input.config ?? {};
  const f = input.flags ?? {};
  const out: Budgets = {
    wallClockMinutes: f.wallClockMinutes ?? c["wallClockMinutes"] ?? DEFAULT_WALL_CLOCK_MINUTES,
    maxTasks: f.maxTasks ?? c["maxTasks"] ?? Math.max(1, input.openTasks * 2),
  };
  const tokens = f.maxTokens ?? c["maxTokens"];
  if (tokens !== undefined) out.maxTokens = tokens;
  return out;
}

export interface BudgetSnapshot {
  elapsedMs: number;
  tasksUsed: number;
  tokensUsed?: number;
  /** True when every runner of the run reports usage. */
  reportsUsage: boolean;
}

export interface BudgetDecision {
  exceeded: boolean;
  /** Why the run must stop; recorded in the run state. */
  reason?: string;
  /** Budgets that are set but cannot be enforced, stated at start and when exceeded (FR-013). */
  unenforced: string[];
}

export function budgetDecision(budgets: Budgets, snap: BudgetSnapshot): BudgetDecision {
  const unenforced: string[] = [];
  if (budgets.maxTokens !== undefined && !snap.reportsUsage) unenforced.push("token ceiling not enforceable for this runner (it does not report usage)");
  if (snap.elapsedMs > budgets.wallClockMinutes * 60_000) {
    return { exceeded: true, reason: `wall-clock budget of ${budgets.wallClockMinutes} minutes exceeded`, unenforced };
  }
  if (snap.tasksUsed > budgets.maxTasks) {
    return { exceeded: true, reason: `task budget of ${budgets.maxTasks} exceeded (${snap.tasksUsed} used)`, unenforced };
  }
  if (budgets.maxTokens !== undefined && snap.reportsUsage && (snap.tokensUsed ?? 0) > budgets.maxTokens) {
    return { exceeded: true, reason: `token ceiling of ${budgets.maxTokens} exceeded (${snap.tokensUsed} used)`, unenforced };
  }
  return { exceeded: false, unenforced };
}

/** After a stop or budget directive: terminate a lane that has not reported for the stop grace (FR-014). */
export function mustTerminate(input: { stopRequestedAt: number; lastReportAt: number | null; now: number; graceMinutes: number }): boolean {
  const last = Math.max(input.stopRequestedAt, input.lastReportAt ?? 0);
  return input.now - last > input.graceMinutes * 60_000;
}

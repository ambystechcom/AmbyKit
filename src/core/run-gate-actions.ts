import { readRun, updateRun, type RunGate, type RunRecord } from "./fleet/index.js";
import type { TaskLine } from "./dashboard.js";

/**
 * Story-checkpoint gates (feature 028, FR-015). 028 is the single gate owner: the gate lives in `run.json`
 * `gates[]` (spec 025's schema), and `approveGate` / `rejectGate` are the one pair of functions that change
 * it. `ambykit run approve|reject`, the foreground prompt and the dashboard (spec 029) all call them; a gate is
 * never a directive. Writes go through 025's `updateRun`.
 */

export const phaseGateId = (phase: number): string => `phase-${phase}`;

/**
 * The stories a phase's tasks belong to that are now complete (every task of the story, in any phase, is
 * checked). A phase that completes no story has no checkpoint (a setup or polish phase).
 */
export function completedStories(tasks: TaskLine[], phase: number): string[] {
  const inPhase = new Set(tasks.filter((t) => t.phase === phase && t.story).map((t) => t.story as string));
  return [...inPhase].filter((story) => tasks.filter((t) => t.story === story).every((t) => t.done)).sort();
}

export type GateResult = { ok: true; run: RunRecord; gate: RunGate } | { ok: false; error: string };

export const pendingGates = (rec: RunRecord): RunGate[] => rec.gates.filter((g) => g.state === "pending");

/** Record a checkpoint that waits for a person; the run waits (`waiting-person`) until it is approved. */
export function openGate(root: string, run: string, phase: number, stories: string[]): GateResult {
  const rec = readRun(root, run);
  if (!rec) return { ok: false, error: `run '${run}' not found` };
  const id = phaseGateId(phase);
  const existing = rec.gates.find((g) => g.id === id);
  if (existing) return { ok: true, run: rec, gate: existing };
  const gate: RunGate = { id, after: stories.join(", "), state: "pending" };
  const out = updateRun(root, run, { gates: [...rec.gates, gate], status: "waiting-person", needsDecision: true });
  return out.ok ? { ok: true, run: out.run, gate } : { ok: false, error: out.warning };
}

function pick(rec: RunRecord, gateId?: string): RunGate | string {
  const pending = pendingGates(rec);
  if (gateId) {
    const g = rec.gates.find((x) => x.id === gateId);
    return g ?? `run ${rec.run} has no gate '${gateId}'; gates: ${rec.gates.map((x) => x.id).join(", ") || "none"}`;
  }
  if (pending.length === 1) return pending[0]!;
  if (pending.length === 0) return `run ${rec.run} has no gate waiting for approval`;
  return `run ${rec.run} has several gates waiting (${pending.map((g) => g.id).join(", ")}); name one with --gate=<id>`;
}

export interface GateDecision {
  gate?: string;
  reason?: string;
  by?: string;
  now?: Date;
}

/** FR-015: a person approves a checkpoint; the run continues with the next prepared set. */
export function approveGate(root: string, run: string, input: GateDecision = {}): GateResult {
  const rec = readRun(root, run);
  if (!rec) return { ok: false, error: `run '${run}' not found` };
  const g = pick(rec, input.gate);
  if (typeof g === "string") return { ok: false, error: g };
  const at = (input.now ?? new Date()).toISOString();
  const gates = rec.gates.map((x) => (x.id === g.id ? { ...x, state: "approved" as const } : x));
  const approvals = [...rec.approvals, { kind: "gate", gate: g.id, decision: "approved", at, ...(input.by ? { by: input.by } : {}), ...(input.reason ? { reason: input.reason } : {}) }];
  const stillWaiting = gates.some((x) => x.state === "pending");
  const patch: Parameters<typeof updateRun>[2] = { gates, approvals };
  if (!stillWaiting && (rec.status === "waiting-person" || rec.status === "paused")) {
    patch.status = "active";
    patch.needsDecision = false;
  }
  const out = updateRun(root, run, patch);
  return out.ok ? { ok: true, run: out.run, gate: { ...g, state: "approved" } } : { ok: false, error: out.warning };
}

/** FR-015: a person rejects a checkpoint; the run pauses with the reason recorded and the gate stays pending. */
export function rejectGate(root: string, run: string, input: GateDecision = {}): GateResult {
  const rec = readRun(root, run);
  if (!rec) return { ok: false, error: `run '${run}' not found` };
  const g = pick(rec, input.gate);
  if (typeof g === "string") return { ok: false, error: g };
  const at = (input.now ?? new Date()).toISOString();
  const approvals = [...rec.approvals, { kind: "gate", gate: g.id, decision: "rejected", at, ...(input.by ? { by: input.by } : {}), ...(input.reason ? { reason: input.reason } : {}) }];
  const out = updateRun(root, run, { approvals, status: "paused", needsDecision: true });
  return out.ok ? { ok: true, run: out.run, gate: g } : { ok: false, error: out.warning };
}

/** The latest decision recorded for a gate, for the loop and the dashboard. */
export function lastDecision(rec: RunRecord, gateId: string): { decision: "approved" | "rejected"; reason?: string; at: string } | null {
  for (let i = rec.approvals.length - 1; i >= 0; i--) {
    const a = rec.approvals[i] as { kind?: string; gate?: string; decision?: "approved" | "rejected"; reason?: string; at?: string } | null;
    if (a && a.kind === "gate" && a.gate === gateId && a.decision && a.at) return { decision: a.decision, ...(a.reason ? { reason: a.reason } : {}), at: a.at };
  }
  return null;
}

/** FR-009: a person approves moving a lane to another assistant. Recorded in `approvals[]`; the loop acts on it. */
export function approveReassign(root: string, run: string, lane: string, to: string, by = "person", now = new Date()): GateResult | { ok: true; run: RunRecord } | { ok: false; error: string } {
  const rec = readRun(root, run);
  if (!rec) return { ok: false, error: `run '${run}' not found` };
  const short = lane.slice(lane.lastIndexOf(".lane-") + 1).replace(/^(\d)/, "lane-$1");
  const known = rec.lanes.find((l) => l.lane.slice(l.lane.lastIndexOf(".lane-") + 1) === short);
  if (!known) return { ok: false, error: `run ${run} has no lane '${lane}'; lanes: ${rec.lanes.map((l) => l.lane.slice(l.lane.lastIndexOf(".lane-") + 1)).join(", ") || "none"}` };
  const out = updateRun(root, run, { approvals: [...rec.approvals, { kind: "reassign", lane: short, to, by, at: now.toISOString() }] });
  return out.ok ? { ok: true, run: out.run } : { ok: false, error: out.warning };
}

/** Record that a run needs a person (a conflict, a restart limit, a review that never converged). */
export function escalate(root: string, run: string, record: Record<string, unknown>): void {
  const rec = readRun(root, run);
  if (!rec) return;
  updateRun(root, run, { escalations: [...rec.escalations, { ...record, at: new Date().toISOString() }], status: "waiting-person", needsDecision: true });
}

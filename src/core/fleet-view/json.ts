import type { FleetView } from "./types.js";

/**
 * The `fleet` object of `ambykit dashboard --json --overview` (feature 029, FR-012/FR-013). Added only when a
 * run exists; bare `--json` and the one-shot text never carry it. Fields are only ever added, never removed or
 * renamed (`specs/029-fleet-control-room/contracts/dashboard-json-fleet.md`).
 */

export interface FleetJson {
  run: string;
  feature: string;
  status: string;
  phase: number;
  stage: string;
  round: number;
  limit: number;
  needsDecision: boolean;
  gates: { id: string; after: string; state: string }[];
  lanes: {
    lane: string;
    assistant: string;
    state: string;
    stalled: boolean;
    /** ISO time of the lane's latest report; absent when it has not reported. */
    lastActivity?: string;
    idleMinutes?: number;
    directive: { action: string; status: string };
  }[];
  /** Other unfinished runs, not shown in `lanes`. */
  others: string[];
}

export function fleetJson(view: FleetView): FleetJson {
  const r = view.run;
  return {
    run: r.run,
    feature: r.feature,
    status: r.status,
    phase: r.phase,
    stage: r.stage,
    round: r.round,
    limit: r.limit,
    needsDecision: r.needsDecision,
    gates: r.gates.map((g) => ({ id: g.id, after: g.after, state: g.state })),
    lanes: view.lanes.map((l) => ({
      lane: l.lane,
      assistant: l.assistant,
      state: l.state,
      stalled: l.stalled,
      ...(l.lastReportAt !== undefined ? { lastActivity: l.lastReportAt } : {}),
      ...(l.idleMinutes !== undefined ? { idleMinutes: l.idleMinutes } : {}),
      directive: { action: l.directive.action, status: l.directive.status },
    })),
    others: view.others,
  };
}

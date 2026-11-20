import { shortLane } from "../activity.js";
import type { LaneStatus } from "../fleet/lane-status.js";
import type { RunLane, RunRecord } from "../fleet/types.js";
import type { LaneView, RunView } from "./types.js";

/**
 * Pure mapping from spec 025's results to view rows (feature 029, FR-003/FR-005/FR-007). It holds no stall
 * rule and parses no state file: the stalled flag and the directive words are `laneStatus`'s. Bad or
 * missing data becomes an `unknown` row, never an error.
 */

/** One lane row from the run's lane record and 025's status for it (null or failed ⇒ unknown). */
export function laneView(lane: RunLane, status: LaneStatus | null): LaneView {
  const short = shortLane(lane.lane);
  const assistant = lane.assistant || "unknown";
  if (!status) {
    return { lane: short, assistant, state: "unknown", stalled: false, directive: { action: "continue", status: "none" }, tasks: lane.tasks ?? [] };
  }
  return {
    lane: short,
    assistant,
    state: status.state,
    stalled: status.stalled,
    stallMinutes: status.stallMinutes,
    ...(status.idleMinutes !== undefined ? { idleMinutes: status.idleMinutes } : {}),
    ...(status.lastReportAt !== undefined ? { lastReportAt: status.lastReportAt } : {}),
    directive: { action: status.directive.action, status: status.directive.status },
    tasks: lane.tasks ?? [],
  };
}

/** The run header the view shows, from the run record (025 `run.json`). */
export function runView(rec: RunRecord): RunView {
  return {
    run: rec.run,
    feature: rec.feature,
    status: rec.status,
    phase: rec.phase,
    stage: rec.stage,
    round: rec.round,
    limit: rec.limit,
    needsDecision: rec.needsDecision,
    gates: rec.gates.map((g) => ({ id: g.id, after: g.after, state: g.state })),
  };
}

/** Rows sorted by lane name (`lane-1-2` before `lane-1-10`), so the order is stable between refreshes. */
export function sortLanes(lanes: LaneView[]): LaneView[] {
  const key = (l: string): number[] => (l.match(/\d+/g) ?? []).map(Number);
  return [...lanes].sort((a, b) => {
    const ka = key(a.lane);
    const kb = key(b.lane);
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      const d = (ka[i] ?? 0) - (kb[i] ?? 0);
      if (d !== 0) return d;
    }
    return a.lane.localeCompare(b.lane);
  });
}

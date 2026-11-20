import { existsSync } from "node:fs";
import { shortLane } from "../activity.js";
import { fleetRoot, listRuns } from "../fleet/runs.js";
import { laneStatus, type LaneStatus } from "../fleet/lane-status.js";
import { UNFINISHED } from "../fleet/types.js";
import { isFailed } from "../query.js";
import { laneView, runView, sortLanes } from "./derive.js";
import type { FleetView } from "./types.js";

/**
 * The read edge (feature 029, FR-001/FR-003/FR-013): `FleetView | null` from spec 025's readers. It touches
 * nothing when `.amby/fleet` does not exist (no run ⇒ null, zero extra IO for a project that never ran a
 * fleet), shows the most recently created unfinished run, and turns any lane it cannot read into an
 * `unknown` row rather than an error.
 */

export function readFleet(root: string, now: number = Date.now()): FleetView | null {
  try {
    if (!existsSync(fleetRoot(root))) return null;
    const open = listRuns(root).filter((r) => UNFINISHED.includes(r.status));
    if (open.length === 0) return null;
    const newest = [...open].sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0") || b.run.localeCompare(a.run))[0]!;
    const lanes = newest.lanes.map((lane) => {
      let status: LaneStatus | null = null;
      try {
        const s = laneStatus(root, { feature: newest.feature, lane: shortLane(lane.lane), run: newest.run, now });
        status = isFailed(s) ? null : s;
      } catch {
        status = null;
      }
      return laneView(lane, status);
    });
    return {
      run: runView(newest),
      lanes: sortLanes(lanes),
      others: open.filter((r) => r.run !== newest.run).map((r) => r.run).sort(),
      now,
    };
  } catch {
    return null;
  }
}

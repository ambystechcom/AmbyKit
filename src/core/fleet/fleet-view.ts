import { shortLane } from "../activity.js";
import { laneView, runView, sortLanes } from "../fleet-view/derive.js";
import type { LaneView, RunView } from "../fleet-view/types.js";
import { affectedBy } from "../fleet-plan/contain.js";
import type { FleetBudgets, FleetCaps, FleetFeatureState, FleetStatus, WaitsFor } from "../fleet-plan/types.js";
import { isFailed } from "../query.js";
import { listFleets } from "./fleets.js";
import { laneStatus } from "./lane-status.js";
import { readRun } from "./runs.js";

/**
 * The fleet read model (feature 031, FR-014, US-6, US-8): fleets, then their features, then each feature's run
 * and lanes with states. Read-only and model-free: built from `fleet.json`, spec 025's run record and `laneStatus`
 * (which owns the stall rule). `ambykit fleet --json`, and spec 029's and 032's views, consume it. It renders
 * nothing.
 */

export interface FleetFeatureView {
  feature: string;
  state: FleetFeatureState;
  waitsFor: WaitsFor[];
  /** The feature whose pause holds this one. */
  heldBy?: string;
  /** Why a paused feature is paused (the latest escalation of its run), when known. */
  cause?: string;
  /** For a paused feature: it and every feature it holds. */
  affected?: string[];
  /** Open tasks with no usable file ownership (FR-006). */
  unknownOwnership: string[];
  run?: RunView;
  lanes: LaneView[];
}

export interface FleetsEntry {
  fleet: string;
  status: FleetStatus;
  createdAt: string;
  caps: FleetCaps;
  budgets: FleetBudgets;
  features: FleetFeatureView[];
}

export interface FleetsView {
  fleets: FleetsEntry[];
}

export function fleetsView(root: string, now: number = Date.now()): FleetsView {
  const fleets = listFleets(root).map((rec): FleetsEntry => {
    const features = rec.features.map((f): FleetFeatureView => {
      const run = f.run ? readRun(root, f.run) : null;
      const lanes = run
        ? sortLanes(
            run.lanes.map((lane) => {
              let status = null;
              try {
                const s = laneStatus(root, { feature: run.feature, lane: shortLane(lane.lane), run: run.run, now });
                status = isFailed(s) ? null : s;
              } catch {
                status = null;
              }
              return laneView(lane, status);
            }),
          )
        : [];
      const last = run?.escalations[run.escalations.length - 1] as { kind?: string; lane?: string; reason?: string } | undefined;
      const cause = f.state === "paused" ? [last?.kind ?? "paused", last?.lane ? `on ${last.lane}` : "", last?.reason ? `(${last.reason})` : ""].filter(Boolean).join(" ") : undefined;
      return {
        feature: f.feature,
        state: f.state,
        waitsFor: f.waitsFor,
        ...(f.heldBy ? { heldBy: f.heldBy } : {}),
        ...(cause ? { cause } : {}),
        ...(f.state === "paused" ? { affected: affectedBy(rec.features, f.feature) } : {}),
        unknownOwnership: f.ownership.unknown,
        ...(run ? { run: runView(run) } : {}),
        lanes,
      };
    });
    return { fleet: rec.fleet, status: rec.status, createdAt: rec.createdAt, caps: rec.caps, budgets: rec.budgets, features };
  });
  return { fleets };
}

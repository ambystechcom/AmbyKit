import { nextToStart, type QueuedLane } from "../run-schedule.js";
import type { FleetCaps, FleetFeature } from "./types.js";

/**
 * What may start (feature 031, FR-007, FR-010, FR-012). Pure.
 *
 * A feature starts only when it is waiting, nothing holds it, and every feature it waits for is done (for a
 * `shared-files` wait that means the earlier feature's lanes are merged into its branch, clarification C-1).
 * Lanes start under the fleet-wide caps: `nextToStart` from spec 028 is given the lanes running in EVERY
 * feature, so the total and per-type caps hold across the fleet, not per feature.
 */

export function startableFeatures(features: readonly FleetFeature[]): FleetFeature[] {
  const state = new Map(features.map((f) => [f.feature, f.state]));
  return features.filter(
    (f) =>
      f.state === "waiting" &&
      f.heldBy === undefined &&
      f.waitsFor.every((w) => state.get(w.feature) === "done" || state.get(w.feature) === "skipped" || !state.has(w.feature)),
  );
}

/** Why a waiting feature is not startable now, for the status view ("waiting for 030-base (depends-on)"). */
export function blockedBy(feature: FleetFeature, features: readonly FleetFeature[]): string[] {
  if (feature.heldBy) return [`held by ${feature.heldBy}`];
  const state = new Map(features.map((f) => [f.feature, f.state]));
  return feature.waitsFor.filter((w) => state.get(w.feature) !== "done" && state.get(w.feature) !== "skipped" && state.has(w.feature)).map((w) => `${w.feature} (${w.why})`);
}

/** Lanes to start now: `queue` is every startable queued lane in fleet order, `running` every running lane of every feature. */
export function fleetLaneStarts(queue: QueuedLane[], running: QueuedLane[], caps: FleetCaps, held: ReadonlySet<string> = new Set()): QueuedLane[] {
  return nextToStart(queue, running, caps, held);
}

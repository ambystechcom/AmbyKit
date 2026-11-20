import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { primaryRoot } from "../checkouts.js";
import type { FleetRecord } from "../fleet-plan/types.js";
import { withLock, writeFileAtomic } from "./lock.js";
import { ensureFleetRoot, fleetDir, fleetIds, isFleetId } from "./runs.js";

/**
 * The fleet record (feature 031, FR-017, FR-021). A fleet owns `.amby/fleet/fleet-<n>/`: its `fleet.json` and the
 * per-feature runs `<feature>.<n>/` (spec 019's ids), nested so spec 025's run resolution finds a feature's
 * unfinished run inside the fleet it belongs to. State is files, readable without a model.
 */

const STATUSES = ["active", "paused", "waiting-person", "done"];

export function nextFleetId(root: string): string {
  const nums = fleetIds(root).map((id) => Number(id.slice(6)));
  return `fleet-${Math.max(0, ...nums) + 1}`;
}

export function readFleetRecord(root: string, fleet: string): FleetRecord | null {
  if (!isFleetId(fleet)) return null;
  try {
    const raw = JSON.parse(readFileSync(join(fleetDir(root, fleet), "fleet.json"), "utf8")) as Partial<FleetRecord>;
    if (!raw || typeof raw.fleet !== "string" || !Array.isArray(raw.features) || !STATUSES.includes(raw.status as string)) return null;
    return raw as FleetRecord;
  } catch {
    return null;
  }
}

export function listFleets(root: string): FleetRecord[] {
  return fleetIds(root)
    .map((id) => readFleetRecord(root, id))
    .filter((f): f is FleetRecord => f !== null);
}

export function writeFleetRecord(root: string, record: FleetRecord): void {
  mkdirSync(fleetDir(root, record.fleet), { recursive: true });
  writeFileAtomic(join(fleetDir(root, record.fleet), "fleet.json"), JSON.stringify(record, null, 2) + "\n");
}

export type FleetResult = { ok: true; fleet: FleetRecord } | { ok: false; warning: string };

/** Create the next fleet (its own id and directory) from a plan's record, under the same lock as run creation. */
export function createFleet(root: string, init: Omit<FleetRecord, "fleet" | "createdAt" | "status"> & { createdAt?: string }): FleetResult {
  ensureFleetRoot(root);
  const locked = withLock(primaryRoot(root), "fleet-runs", () => {
    const record: FleetRecord = { ...init, fleet: nextFleetId(root), status: "active", createdAt: init.createdAt ?? new Date().toISOString() };
    writeFleetRecord(root, record);
    return record;
  });
  return locked.ok ? { ok: true, fleet: locked.value } : { ok: false, warning: locked.warning };
}

/** Merge `patch` into the record under the lock. The id and creation time never change. */
export function updateFleet(root: string, fleet: string, patch: Partial<Omit<FleetRecord, "fleet" | "createdAt">>): FleetResult {
  const locked = withLock(primaryRoot(root), "fleet-runs", () => {
    const current = readFleetRecord(root, fleet);
    if (!current) return null;
    const next: FleetRecord = { ...current, ...patch, fleet: current.fleet, createdAt: current.createdAt };
    writeFleetRecord(root, next);
    return next;
  });
  if (!locked.ok) return { ok: false, warning: locked.warning };
  if (!locked.value) return { ok: false, warning: `fleet '${fleet}' not found` };
  return { ok: true, fleet: locked.value };
}

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFleet, createRun, fleetOfRun, fleetRoot, listFleets, listRuns, nextFleetId, readFleetRecord, readRun, resolveRun, runDir, updateFleet, updateRun } from "../../src/core/fleet/index.js";
import type { FleetRecord } from "../../src/core/fleet-plan/types.js";
import { tempProject } from "../helpers/spec-project.js";

const init: Omit<FleetRecord, "fleet" | "createdAt" | "status"> = {
  features: [{ feature: "031-a", state: "waiting", waitsFor: [], ownership: { files: [], unknown: [] }, fingerprint: "f" }],
  caps: { total: 3, perType: 2 },
  budgets: { wallClockMinutes: 60, maxTasks: 10 },
  unattended: false,
};

describe("fleet record and nested runs (feature 031)", () => {
  it("031:FR-021: each fleet gets its own id and directory under .amby/fleet/", () => {
    const root = tempProject({});
    const a = createFleet(root, init);
    const b = createFleet(root, init);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect([a.fleet.fleet, b.fleet.fleet]).toEqual(["fleet-1", "fleet-2"]);
      expect(existsSync(join(fleetRoot(root), "fleet-2", "fleet.json"))).toBe(true);
    }
    expect(nextFleetId(root)).toBe("fleet-3");
    expect(listFleets(root).map((f) => f.fleet)).toEqual(["fleet-1", "fleet-2"]);
  });

  it("031:FR-017: fleet state is a readable file that can be updated, keeping its id and creation time", () => {
    const root = tempProject({});
    const made = createFleet(root, init);
    if (!made.ok) throw new Error(made.warning);
    const up = updateFleet(root, "fleet-1", { status: "paused" });
    expect(up.ok && up.fleet.status).toBe("paused");
    expect(readFleetRecord(root, "fleet-1")?.createdAt).toBe(made.fleet.createdAt);
    expect(updateFleet(root, "fleet-9", { status: "done" }).ok).toBe(false);
  });

  it("031:FR-021: a feature's run is created inside the fleet directory, and run readers find it there", () => {
    const root = tempProject({});
    createFleet(root, init);
    const made = createRun(root, "031-a", { fleet: "fleet-1" });
    if (!made.ok) throw new Error(made.warning);
    expect(made.run.run).toBe("031-a.1");
    expect(runDir(root, "031-a.1")).toBe(join(fleetRoot(root), "fleet-1", "031-a.1"));
    expect(fleetOfRun(root, "031-a.1")).toBe("fleet-1");
    expect(readRun(root, "031-a.1")?.feature).toBe("031-a");
    expect(listRuns(root, "031-a").map((r) => r.run)).toEqual(["031-a.1"]);
    expect(updateRun(root, "031-a.1", { status: "paused" }).ok).toBe(true);
  });

  it("031:FR-021: run resolution (report_activity's) finds the feature's unfinished run inside its fleet", () => {
    const root = tempProject({});
    createFleet(root, init);
    createRun(root, "031-a", { fleet: "fleet-1" });
    const r = resolveRun(root, "031-a");
    expect(r.ok && r.run.run).toBe("031-a.1");
  });

  it("031:FR-019: a flat single run is unchanged: same directory, no fleet", () => {
    const root = tempProject({});
    const made = createRun(root, "031-a");
    if (!made.ok) throw new Error(made.warning);
    expect(runDir(root, "031-a.1")).toBe(join(fleetRoot(root), "031-a.1"));
    expect(fleetOfRun(root, "031-a.1")).toBeUndefined();
    expect(listRuns(root).map((r) => r.run)).toEqual(["031-a.1"]);
  });

  it("031:FR-021: run numbers are never reused across flat and nested runs of one feature", () => {
    const root = tempProject({});
    createRun(root, "031-a");
    createFleet(root, init);
    const nested = createRun(root, "031-a", { fleet: "fleet-1" });
    expect(nested.ok && nested.run.run).toBe("031-a.2");
  });
});

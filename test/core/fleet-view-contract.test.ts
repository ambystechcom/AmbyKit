import { describe, expect, it } from "vitest";
import { fleetSettings } from "../../src/core/config.js";
import * as fleet from "../../src/core/fleet/index.js";
import { approveGate, pendingGates } from "../../src/core/run-gate-actions.js";
import { FEATURE, fleetProject } from "../helpers/fleet-fixture.js";

// The exports and run.json fields 029 reads. If 025, 028 or 019 drops one, this fails first and names it.
const USED = ["readRun", "listRuns", "fleetRoot", "laneStatus", "writeDirective", "readDirective", "directiveStatus", "directivePath"] as const;

describe("029 depends on specs 025, 028 and 019 (T010)", () => {
  it.each(USED)("029:FR-013: %s is exported by spec 025's fleet module", (name) => {
    expect(typeof (fleet as Record<string, unknown>)[name]).toBe("function");
  });

  it("029:FR-005: fleet.stallMinutes defaults to 15 and is the one stall setting (025)", () => {
    expect(fleetSettings(null).stallMinutes).toBe(15);
    expect(fleetSettings({ fleet: { stallMinutes: 7 } }).stallMinutes).toBe(7);
  });

  it("029:FR-004: run.json carries stage, round, limit and needsDecision (019 writes them, 025 owns the schema)", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }], { stage: "qa", round: 1, needsDecision: true });
    const rec = fleet.readRun(f.root, f.run)!;
    expect(rec).toMatchObject({ stage: "qa", round: 1, needsDecision: true });
    expect(typeof rec.limit).toBe("number");
  });

  it("029:FR-009: gates[] and approveGate are 028's, and approving writes no directive file", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "paused" }], { status: "waiting-person", gates: [{ id: "phase-1", after: "US-1", state: "pending" }] });
    expect(pendingGates(fleet.readRun(f.root, f.run)!).map((g) => g.id)).toEqual(["phase-1"]);
    const out = approveGate(f.root, f.run, { gate: "phase-1", by: "test" });
    expect(out.ok).toBe(true);
    expect(fleet.readDirective(f.root, f.run, "lane-1-1")).toBeNull();
    expect(FEATURE).toBeTruthy();
  });
});

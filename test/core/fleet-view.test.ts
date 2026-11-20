import { describe, expect, it } from "vitest";
import { createFleet, createRun, fleetsView, updateRun } from "../../src/core/fleet/index.js";
import type { FleetFeature } from "../../src/core/fleet-plan/types.js";
import { tempProject } from "../helpers/spec-project.js";

const feat = (feature: string, state: FleetFeature["state"], over: Partial<FleetFeature> = {}): FleetFeature => ({
  feature,
  state,
  waitsFor: [],
  ownership: { files: [], unknown: [] },
  fingerprint: "f",
  ...over,
});

describe("fleet view (feature 031)", () => {
  it("031:FR-014: lists features, then each feature's run and lanes with states", () => {
    const root = tempProject({});
    const fleet = createFleet(root, {
      features: [feat("031-a", "running", { run: "031-a.1" }), feat("032-b", "waiting", { waitsFor: [{ feature: "031-a", why: "depends-on" }] })],
      caps: { total: 3, perType: 2 },
      budgets: { wallClockMinutes: 60, maxTasks: 10 },
      unattended: false,
    });
    if (!fleet.ok) throw new Error(fleet.warning);
    createRun(root, "031-a", { fleet: "fleet-1", lanes: [{ lane: "031-a.lane-1-1", assistant: "claude", tasks: ["T001"] }] });
    const v = fleetsView(root);
    expect(v.fleets).toHaveLength(1);
    const [a, b] = v.fleets[0]!.features;
    expect(a!.run?.run).toBe("031-a.1");
    expect(a!.lanes.map((l) => [l.lane, l.assistant])).toEqual([["lane-1-1", "claude"]]);
    expect(b!.waitsFor).toEqual([{ feature: "031-a", why: "depends-on" }]);
    expect(b!.lanes).toEqual([]);
  });

  it("031:FR-009: a paused feature shows its cause and the features it affects", () => {
    const root = tempProject({});
    createFleet(root, {
      features: [feat("031-a", "paused", { run: "031-a.1" }), feat("032-b", "waiting", { waitsFor: [{ feature: "031-a", why: "depends-on" }], heldBy: "031-a" })],
      caps: { total: 3, perType: 2 },
      budgets: { wallClockMinutes: 60, maxTasks: 10 },
      unattended: false,
    });
    createRun(root, "031-a", { fleet: "fleet-1" });
    updateRun(root, "031-a.1", { escalations: [{ kind: "restart-limit", lane: "lane-1-1" }] });
    const a = fleetsView(root).fleets[0]!.features[0]!;
    expect(a.cause).toBe("restart-limit on lane-1-1");
    expect(a.affected).toEqual(["031-a", "032-b"]);
    expect(fleetsView(root).fleets[0]!.features[1]!.heldBy).toBe("031-a");
  });

  it("031:FR-014: no fleets means an empty view, with nothing created", () => {
    expect(fleetsView(tempProject({}))).toEqual({ fleets: [] });
  });

  it("031:FR-006: unknown ownership is carried to the view by task id", () => {
    const root = tempProject({});
    createFleet(root, {
      features: [feat("031-a", "waiting", { ownership: { files: [], unknown: ["T002"] } })],
      caps: { total: 3, perType: 2 },
      budgets: { wallClockMinutes: 60, maxTasks: 10 },
      unattended: false,
    });
    expect(fleetsView(root).fleets[0]!.features[0]!.unknownOwnership).toEqual(["T002"]);
  });
});

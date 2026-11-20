import { describe, expect, it } from "vitest";
import { blockedBy, fleetLaneStarts, startableFeatures } from "../../src/core/fleet-plan/schedule.js";
import type { FleetFeature, FleetFeatureState, WaitsFor } from "../../src/core/fleet-plan/types.js";

const f = (feature: string, state: FleetFeatureState, waitsFor: WaitsFor[] = [], heldBy?: string): FleetFeature => ({
  feature,
  state,
  waitsFor,
  ...(heldBy ? { heldBy } : {}),
  ownership: { files: [], unknown: [] },
  fingerprint: "x",
});

describe("fleet schedule (feature 031)", () => {
  it("031:FR-007: a feature starts only once everything it waits for is done", () => {
    const fs = [f("a", "running"), f("b", "waiting", [{ feature: "a", why: "depends-on" }]), f("c", "waiting")];
    expect(startableFeatures(fs).map((x) => x.feature)).toEqual(["c"]);
    fs[0]!.state = "done";
    expect(startableFeatures(fs).map((x) => x.feature)).toEqual(["b", "c"]);
  });

  it("031:FR-009: a held feature does not start even when what it waits for is done", () => {
    const fs = [f("a", "done"), f("b", "waiting", [{ feature: "a", why: "depends-on" }], "z")];
    expect(startableFeatures(fs)).toEqual([]);
    expect(blockedBy(fs[1]!, fs)).toEqual(["held by z"]);
  });

  it("031:FR-007: blockedBy names the feature and why it waits", () => {
    const fs = [f("a", "running"), f("b", "waiting", [{ feature: "a", why: "shared-files", files: ["x"] }])];
    expect(blockedBy(fs[1]!, fs)).toEqual(["a (shared-files)"]);
  });

  it("031:FR-010: lanes start under the total cap counting lanes running in every feature", () => {
    const running = [{ lane: "a.lane-1-1", assistant: "claude" }, { lane: "b.lane-1-1", assistant: "codex" }];
    const queue = [{ lane: "c.lane-1-1", assistant: "claude" }, { lane: "c.lane-1-2", assistant: "codex" }];
    const start = fleetLaneStarts(queue, running, { total: 3, perType: 2 });
    expect(start.map((l) => l.lane)).toEqual(["c.lane-1-1"]);
  });

  it("031:FR-012: the per-type cap holds across features and does not block another type", () => {
    const running = [{ lane: "a.lane-1-1", assistant: "claude" }, { lane: "b.lane-1-1", assistant: "claude" }];
    const queue = [{ lane: "c.lane-1-1", assistant: "claude" }, { lane: "c.lane-1-2", assistant: "codex" }];
    const start = fleetLaneStarts(queue, running, { total: 3, perType: 2 });
    expect(start.map((l) => l.lane)).toEqual(["c.lane-1-2"]);
  });
});

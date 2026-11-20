import { describe, expect, it } from "vitest";
import { currentFleet, featureRunView, groupCounts, groupRows, isGrouped } from "../../src/core/fleet-view/group.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, selectedFleetView, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { featureOf, fleetsOf, lane, runOf, tabData, threeFeatureFleet } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/**
 * Feature 032, FR-018: the fleet tab hosts 029's view and groups lanes by feature across features (spec 031's read model).
 * A fleet of one feature is 029's view, unchanged.
 */

const caps = fakeCapabilities({ color: false, columns: 120 });
type K = string | { name?: string; sequence?: string; shift?: boolean };
const key = (k: K) => (typeof k === "string" ? { name: k, sequence: k.length === 1 ? k : undefined } : k);
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: K[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, key(k)), s);
const frame = (d: OverviewTuiData, s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, d, s));
const grouped = () => tabData({ fleets: threeFeatureFleet() });
const fleetTab = (d: OverviewTuiData) => press(d, initOverviewTui(), "2");

describe("grouping core (feature 032, FR-018)", () => {
  it("032:FR-018: rows are a header per feature followed by its lanes, in fleet order", () => {
    const entry = currentFleet(threeFeatureFleet())!;
    const rows = groupRows(entry, [], { query: "" });
    expect(rows.map((r) => (r.kind === "feature" ? r.feature.feature.slice(0, 3) : `  ${r.lane.lane}`))).toEqual(["030", "  lane-1-1", "031", "  lane-1-1", "  lane-1-2", "032"]);
  });

  it("032:FR-018: a collapsed feature shows its header only, with its lane count", () => {
    const entry = currentFleet(threeFeatureFleet())!;
    const rows = groupRows(entry, ["031-multi-feature-fleets"], { query: "" });
    expect(rows.filter((r) => r.kind === "lane")).toHaveLength(1);
    const header = rows.find((r) => r.kind === "feature" && r.feature.feature.startsWith("031"));
    expect(header).toMatchObject({ expanded: false, laneCount: 2 });
  });

  it("032:FR-018: one feature is not grouped (029's view is shown unchanged); two or more are", () => {
    expect(isGrouped(currentFleet(fleetsOf([featureOf("030-a", "running", [lane("lane-1-1")])])))).toBe(false);
    expect(isGrouped(currentFleet(threeFeatureFleet()))).toBe(true);
    expect(isGrouped(null)).toBe(false);
  });

  it("032:FR-018: the newest fleet is the one shown", () => {
    const old = fleetsOf([featureOf("001-a", "done"), featureOf("002-b", "done")], { fleet: "fleet-1", createdAt: "2026-11-01T00:00:00.000Z" }).fleets[0]!;
    const fresh = fleetsOf([featureOf("030-a", "running"), featureOf("031-b", "waiting")], { fleet: "fleet-2", createdAt: "2026-11-19T00:00:00.000Z" }).fleets[0]!;
    expect(currentFleet({ fleets: [old, fresh] })!.fleet).toBe("fleet-2");
  });

  it("032:FR-018: a feature's run view is 029's FleetView (run, lanes), or null before it starts", () => {
    const [done, running, waiting] = currentFleet(threeFeatureFleet())!.features;
    expect(featureRunView(running!, 1)!.lanes).toHaveLength(2);
    expect(featureRunView(running!, 1)!.run.feature).toBe("031-multi-feature-fleets");
    expect(featureRunView(waiting!, 1)).toBeNull();
    expect(featureRunView(done!, 1)).not.toBeNull();
  });

  it("032:FR-006: the filter keeps a feature by name or by a matching lane, and counts items", () => {
    const entry = currentFleet(threeFeatureFleet())!;
    expect(groupRows(entry, [], { query: "032" }).map((r) => r.kind)).toEqual(["feature"]);
    expect(groupRows(entry, [], { query: "codex" }).map((r) => (r.kind === "lane" ? r.lane.lane : r.feature.feature.slice(0, 3)))).toEqual(["031", "lane-1-2"]);
    expect(groupCounts(entry, { query: "" })).toEqual({ shown: 6, total: 6 });
    expect(groupCounts(entry, { query: "codex" })).toEqual({ shown: 2, total: 6 });
    expect(groupCounts(entry, { query: "", state: "blocked" }).shown).toBe(0);
  });
});

describe("the grouped fleet tab (feature 032, FR-018)", () => {
  it("032:FR-018: shows each feature with its state and what it waits for, lanes under their feature", () => {
    const out = frame(grouped(), fleetTab(grouped()));
    expect(out).toContain("FLEET · fleet-1 · 3 features · caps 3 total / 2 per type");
    expect(out).toMatch(/▾ 030-spec-v2-and-migrate\s+✓ done\s+1 of 1 lanes merged/);
    expect(out).toMatch(/▾ 031-multi-feature-fleets\s+▶ working\s+waits for: —/);
    expect(out).toMatch(/▸?\s*▾ 032-dashboard-redesign\s+◷ waiting\s+waits for: 031-multi-feature-fleets \(merging\)/);
    const lines = out.split("\n");
    const header = lines.findIndex((l) => l.includes("031-multi-feature-fleets") && l.includes("working"));
    expect(lines[header + 1]).toContain("lane-1-1");
    expect(lines[header + 2]).toMatch(/lane-1-2.*Codex.*STALLED 21m/);
  });

  it("032:FR-018: a paused feature names its cause and how many features it holds", () => {
    const d = tabData({
      fleets: fleetsOf([featureOf("030-a", "paused", [lane("lane-1-1", "paused")], { cause: "lane-1-1 failed twice", affected: ["030-a", "031-b"] }), featureOf("031-b", "waiting", [], { waitsFor: [{ feature: "030-a", why: "depends-on" }], heldBy: "030-a" })]),
    });
    expect(frame(d, fleetTab(d))).toContain("cause: lane-1-1 failed twice · holds 1 dependent");
  });

  it("032:FR-018: left collapses the feature under the cursor and right expands it; up and down move over rows", () => {
    const d = grouped();
    const down = press(d, fleetTab(d), "down", "down"); // second header: 031's first lane... row 2 is 031's header
    expect(down.fleetGroup!.cursor).toBe(2);
    const collapsed = press(d, down, "left");
    expect(collapsed.fleetGroup!.collapsed).toEqual(["031-multi-feature-fleets"]);
    const out = frame(d, collapsed);
    expect(out).toMatch(/▸ 031-multi-feature-fleets.*\(2 lanes\)/);
    expect(out).not.toContain("lane-1-2");
    const expanded = press(d, collapsed, "right");
    expect(expanded.fleetGroup!.collapsed).toEqual([]);
    expect(frame(d, expanded)).toContain("lane-1-2");
  });

  it("032:FR-018: collapsing from a lane row moves the cursor to its feature header", () => {
    const d = grouped();
    const onLane = press(d, fleetTab(d), "down", "down", "down"); // 031's lane-1-1
    const out = press(d, onLane, "left");
    expect(groupRows(currentFleet(d.fleets)!, out.fleetGroup!.collapsed, { query: "" })[out.fleetGroup!.cursor]).toMatchObject({ kind: "feature" });
  });

  it("032:FR-018: the key row offers collapse and the group's keys", () => {
    const hints = frame(grouped(), fleetTab(grouped())).split("\n").at(-1)!;
    expect(hints).toMatch(/← → collapse/);
    expect(hints).toMatch(/p pause/);
    expect(hints).toMatch(/a approve/);
  });

  it("032:FR-018: a pending gate of any feature is listed under GATES with its feature number", () => {
    const f = featureOf("031-multi-feature-fleets", "running", [lane("lane-1-1")], { run: runOf("031-multi-feature-fleets", { gates: [{ id: "phase-2", after: "US-3, US-4", state: "pending" }] }) });
    const d = tabData({ fleets: fleetsOf([featureOf("030-a", "done"), f]) });
    expect(frame(d, fleetTab(d))).toMatch(/GATES[\s\S]*031 phase-2 · after US-3, US-4 · awaiting approval/);
  });

  it("032:FR-018: a fleet of one feature is 029's view with no group header", () => {
    const one = tabData({ fleets: fleetsOf([featureOf("030-a", "running", [lane("lane-1-1")])]) });
    const s = fleetTab(one);
    expect(s.fleetGroup).toBeNull();
    const out = frame(one, s);
    expect(out).toContain("FLEET · 001-alpha.1");
    expect(out).not.toContain("▾ 030-a");
  });

  it("032:FR-018: with no fleets and no run the tab is the empty state", () => {
    const d = tabData({ fleet: null, fleets: null });
    expect(frame(d, fleetTab(d))).toContain("No fleet run is active.");
  });
});

describe("directives in the grouped tab (feature 032, FR-018 with 029's rules)", () => {
  it("032:FR-018: a lane action on a lane row opens 029's confirm for that lane and the intent names the lane and the feature's run", () => {
    const d = grouped();
    const onLane = press(d, fleetTab(d), "down", "down", "down"); // 031 lane-1-1
    const confirm = press(d, onLane, "x");
    expect(confirm.fleet!.confirm).toMatchObject({ kind: "stop", target: { kind: "lane", lane: "lane-1-1" } });
    expect(frame(d, confirm)).toContain("STOP LANE");
    const done = press(d, confirm, "y");
    expect(done.fleet!.intent).toMatchObject({ kind: "stop", target: { kind: "lane", lane: "lane-1-1" } });
    expect(selectedFleetView(d, done)!.run.run).toBe("031-multi-feature-fleets.1");
  });

  it("032:FR-018: a whole-run action on a feature header confirms and targets that feature's run", () => {
    const d = grouped();
    const onHeader = press(d, fleetTab(d), "down", "down"); // 031 header
    const confirm = press(d, onHeader, { name: "p", sequence: "P", shift: true });
    expect(confirm.fleet!.confirm).toMatchObject({ kind: "pause", target: { kind: "run", run: "031-multi-feature-fleets.1" } });
    expect(frame(d, confirm)).toContain("PAUSE ALL LANES");
  });

  it("032:FR-018: a lane action on a feature header says to select a lane instead of acting on its first lane", () => {
    const d = grouped();
    const out = press(d, fleetTab(d), "down", "down", "x");
    expect(out.fleet!.confirm).toBeNull();
    expect(out.fleet!.intent).toBeNull();
    expect(out.fleet!.notice).toContain("Select a lane");
  });

  it("032:FR-018: any other key cancels the confirm and writes nothing", () => {
    const d = grouped();
    const confirm = press(d, fleetTab(d), "down", "down", "down", "x");
    const cancelled = press(d, confirm, "n");
    expect(cancelled.fleet).toMatchObject({ confirm: null, intent: null });
  });

  it("032:FR-018: esc goes back to the overview and q quits", () => {
    const d = grouped();
    expect(press(d, fleetTab(d), "escape")).toMatchObject({ view: "overview", fleetGroup: null });
    expect(press(d, fleetTab(d), "q").done).toBe(true);
  });
});

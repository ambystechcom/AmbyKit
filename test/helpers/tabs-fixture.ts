import { fleetViewApi } from "../../src/cli/ui/dashboard/fleet-view.js";
import { fleetTabApi } from "../../src/cli/ui/dashboard/fleet-tab.js";
import { graphViewApi } from "../../src/cli/ui/dashboard/graph-view.js";
import type { OverviewTuiData } from "../../src/cli/ui/interactive/overview.js";
import type { FleetFeatureView, FleetsEntry, FleetsView } from "../../src/core/fleet/fleet-view.js";
import type { LaneView, LaneViewState, RunView } from "../../src/core/fleet-view/types.js";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture } from "./dashboard-fixture.js";
import { fleetView, NOW } from "./fleet-fixture.js";

/** Fixtures for the tabbed dashboard (feature 032): the standard dashboard project plus hand-built fleets (spec 031's read model). */

const { features, issues } = readFeatures(dashboardFixture());

export function lane(name: string, state: LaneViewState = "working", over: Partial<LaneView> = {}): LaneView {
  return { lane: name, assistant: "claude", state, stalled: false, directive: { action: "continue", status: "none" }, tasks: [], ...over };
}

export function runOf(feature: string, over: Partial<RunView> = {}): RunView {
  return { run: `${feature}.1`, feature, status: "active", phase: 1, stage: "working", round: 0, limit: 3, needsDecision: false, gates: [], ...over };
}

export function featureOf(name: string, state: FleetFeatureView["state"], lanes: LaneView[] = [], over: Partial<FleetFeatureView> = {}): FleetFeatureView {
  return { feature: name, state, waitsFor: [], unknownOwnership: [], lanes, ...(lanes.length > 0 || state === "running" ? { run: runOf(name) } : {}), ...over };
}

export function fleetsOf(fs: FleetFeatureView[], over: Partial<FleetsEntry> = {}): FleetsView {
  return {
    fleets: [{ fleet: "fleet-1", status: "active", createdAt: "2026-11-19T10:00:00.000Z", caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 50 }, features: fs, ...over }],
  };
}

/** A fleet of three features: one done, one running with two lanes (one stalled), one waiting on it. */
export function threeFeatureFleet(): FleetsView {
  return fleetsOf([
    featureOf("030-spec-v2-and-migrate", "done", [lane("lane-1-1", "done")]),
    featureOf("031-multi-feature-fleets", "running", [lane("lane-1-1", "working"), lane("lane-1-2", "working", { assistant: "codex", stalled: true, idleMinutes: 21 })]),
    featureOf("032-dashboard-redesign", "waiting", [], { waitsFor: [{ feature: "031-multi-feature-fleets", why: "depends-on" }] }),
  ]);
}

/** The interactive data with the tabbed frame on, and the views the command injects. */
export function tabData(over: Partial<OverviewTuiData> = {}): OverviewTuiData {
  return {
    features,
    issues,
    meta: { crumb: [], cwd: "~/proj", version: "1.6.0" },
    upNextCap: 5,
    burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
    graphView: graphViewApi,
    fleetView: fleetViewApi,
    fleetTab: fleetTabApi,
    tabs: true,
    fleet: fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2", assistant: "codex" }]),
    fleets: null,
    rows: 24,
    ...over,
  };
}

export { features, issues, NOW };

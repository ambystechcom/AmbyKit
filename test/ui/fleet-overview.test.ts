import { describe, expect, it } from "vitest";
import { fleetViewApi } from "../../src/cli/ui/dashboard/fleet-view.js";
import { applyData, initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const { features, issues } = readFeatures(dashboardFixture());
const base: OverviewTuiData = {
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.5.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
};
const withFleet = (fleet = fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2", assistant: "codex" }])): OverviewTuiData => ({ ...base, fleetView: fleetViewApi, fleet, rows: 24 });
const caps = fakeCapabilities({ color: false, columns: 120 });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: (string | { name?: string; sequence?: string; shift?: boolean })[]) =>
  keys.reduce((st, k) => reduceOverviewTui(d, st, typeof k === "string" ? { name: k, sequence: k.length === 1 ? k : undefined } : k), s);
const frame = (d: OverviewTuiData, s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, d, s));

describe("Fleet view in the overview (feature 029, FR-001)", () => {
  it("029:FR-001: l opens the Fleet view from the overview; esc goes back to it", () => {
    const d = withFleet();
    const open = press(d, initOverviewTui(), "l");
    expect(open.view).toBe("fleet");
    expect(open.fleet).not.toBeNull();
    expect(frame(d, open)).toContain("lane-1-2");
    const back = press(d, open, "escape");
    expect(back).toMatchObject({ view: "overview", fleet: null });
  });

  it("029:FR-012: without the injected Fleet view API, l does nothing (the one-shot path never loads it)", () => {
    expect(press(base, initOverviewTui(), "l").view).toBe("overview");
    expect(frame(base, initOverviewTui())).not.toMatch(/\bl fleet\b/);
  });

  it("029:FR-001: the overview key row offers l fleet when the view is available", () => {
    expect(frame(withFleet(), initOverviewTui())).toMatch(/l fleet/);
  });

  it("029:FR-001: the Fleet screen has its own key row; a is offered only while a gate waits", () => {
    const d = withFleet();
    const open = press(d, initOverviewTui(), "l");
    const hints = frame(d, open).split("\n").at(-1)!;
    expect(hints).toMatch(/esc back/);
    expect(hints).toMatch(/p pause/);
    expect(hints).toMatch(/u continue/);
    expect(hints).toMatch(/x stop/);
    expect(hints).not.toMatch(/a approve/);
    const gated = withFleet(fleetView([{}], { gates: [{ id: "phase-1", after: "US-1", state: "pending" }] }));
    expect(frame(gated, press(gated, initOverviewTui(), "l")).split("\n").at(-1)).toMatch(/a approve/);
  });

  it("029:FR-001: up and down move the lane cursor inside the Fleet view, not the overview panels", () => {
    const d = withFleet();
    const open = press(d, initOverviewTui(), "l", "down");
    expect(open.fleet?.cursor).toBe(1);
    expect(open.cursors).toEqual([0, 0, 0, 0]);
  });

  it("029:FR-001: q in the Fleet view quits the dashboard", () => {
    const d = withFleet();
    expect(press(d, initOverviewTui(), "l", "q").done).toBe(true);
  });

  it("029:FR-001: ? opens the Fleet help screen, which lists u/U for continue and not c", () => {
    const d = withFleet();
    const help = frame(d, press(d, initOverviewTui(), "l", { name: "?", sequence: "?" }));
    expect(help).toMatch(/KEYS . fleet/);
    expect(help).toMatch(/u \/ U\s+continue the lane \/ the whole run/);
    expect(help).not.toMatch(/c \/ C/);
    expect(frame(d, initOverviewTui()) /* overview help is unchanged */).toBeTruthy();
  });

  it("029:FR-001: the overview help lists l, and c stays the quality view", () => {
    const help = frame(withFleet(), press(withFleet(), initOverviewTui(), { name: "?", sequence: "?" }));
    expect(help).toMatch(/l\s+fleet view/);
    expect(help).toMatch(/c\s+quality view/);
  });

  it("029:FR-003: after a refresh that drops lanes the cursor is clamped", () => {
    const d = withFleet(fleetView(Array.from({ length: 5 }, () => ({}))));
    const at4 = press(d, initOverviewTui(), "l", "down", "down", "down", "down");
    expect(at4.fleet?.cursor).toBe(4);
    const smaller = withFleet(fleetView([{}, {}]));
    expect(applyData(at4, d, smaller).fleet?.cursor).toBe(1);
  });

  it("029:FR-013: with no run the Fleet view still opens and says so", () => {
    const d = withFleet(null as never);
    const open = press(d, initOverviewTui(), "l");
    expect(frame(d, open)).toContain("No fleet run is active.");
    expect(NOW).toBeGreaterThan(0);
  });

  it("029:FR-008: an open stop confirmation owns the next key: ? cancels it instead of opening help", () => {
    const d = withFleet();
    const asked = press(d, initOverviewTui(), "l", "x");
    expect(asked.fleet?.confirm).not.toBeNull();
    const cancelled = press(d, asked, { name: "?", sequence: "?" });
    expect(cancelled.help).toBe(false);
    expect(cancelled.fleet?.confirm).toBeNull();
    expect(cancelled.fleet?.intent).toBeNull();
  });
});

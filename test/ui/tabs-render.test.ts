import { describe, expect, it } from "vitest";
import { formatDuration, gapTrend, renderMetricsPanel, sparkline } from "../../src/cli/ui/dashboard/metrics-panel.js";
import { renderTabBar } from "../../src/cli/ui/dashboard/tab-bar.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type MetricsState, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import type { GapPoint, Metrics } from "../../src/core/metrics/types.js";
import { tabData } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** Feature 032, US-1 and US-4: the tab bar, the empty states and the FLOW panel in the quality tab. */

const caps = fakeCapabilities({ color: false, columns: 100 });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k, sequence: k.length === 1 ? k : undefined }), s);
const frame = (d: OverviewTuiData, s: OverviewTuiState, c = caps) => stripAnsi(renderOverviewTui(c, d, s));

const cycle = (feature: string, phase: "spec" | "plan" | "tasks" | "converge", ms: number | null) => ({ feature, phase, startedAt: 0, completedAt: ms === null ? null : ms, ms });
const gap = (feature: string, rate: number, gapTasks = 1, requirements = 10): GapPoint => ({ feature, commit: "c", time: 0, gapTasks, requirements, rate });
const metrics = (over: Partial<Metrics> = {}): Metrics => ({
  phases: [
    { phase: "spec", perFeature: [cycle("014-a", "spec", 11_520_000), cycle("017-b", "spec", 7_500_000), cycle("009-c", "spec", 7_080_000), cycle("011-d", "spec", 3_000_000)], typicalMs: 6_000_000 },
    { phase: "plan", perFeature: [cycle("023-a", "plan", 24_000_000)], typicalMs: 11_400_000 },
    { phase: "tasks", perFeature: [cycle("026-a", "tasks", 15_300_000)], typicalMs: 7_500_000 },
    { phase: "converge", perFeature: [], typicalMs: null },
  ],
  gap: [gap("011", 0.3), gap("020", 0.21), gap("025", 0.15), gap("028", 0.14), gap("030", 0.12, 3, 25)],
  skipped: 0,
  enough: true,
  ...over,
});
const ready = (m: Metrics = metrics()): MetricsState => ({ status: "ready", metrics: m });

describe("tab bar (feature 032, US-1)", () => {
  it("032:FR-001: lists the four tabs with their numbers and brackets exactly the active one", () => {
    for (const [tab, text] of [["overview", "[1 overview]"], ["fleet", "[2 fleet]"], ["graph", "[3 graph]"], ["quality", "[4 quality]"]] as const) {
      const bar = stripAnsi(renderTabBar(caps, { active: tab }));
      expect(bar).toContain(text);
      expect(bar.match(/\[/g)).toHaveLength(1);
      for (const n of ["1 overview", "2 fleet", "3 graph", "4 quality"]) expect(bar).toContain(n);
    }
  });

  it("032:FR-001: the active tab is distinguishable without color (brackets) and with color (bold)", () => {
    expect(hasAnsi(renderTabBar(caps, { active: "fleet" }))).toBe(false);
    const colored = renderTabBar(fakeCapabilities({ columns: 100 }), { active: "fleet" });
    expect(colored).toContain("\x1b[1;");
  });

  it("032:FR-001: a badge appears only on the tab that has something to read first, in both icon sets", () => {
    const bar = stripAnsi(renderTabBar(caps, { active: "overview", badges: { fleet: "attention", quality: "warn" } }));
    expect(bar).toContain("fleet ●");
    expect(bar).toContain("quality ⚠");
    expect(bar).not.toContain("graph ⚠");
    const ascii = stripAnsi(renderTabBar(fakeCapabilities({ color: false, unicode: false, columns: 100 }), { active: "overview", badges: { fleet: "attention", graph: "warn" } }));
    expect(ascii).toContain("fleet *");
    expect(ascii).toContain("graph [!]");
  });

  it("032:FR-012: under 60 columns the names shorten, numbers and brackets stay, and it is one line", () => {
    const bar = stripAnsi(renderTabBar(fakeCapabilities({ color: false, columns: 50 }), { active: "overview" }));
    expect(bar).toBe("[1 ovw] 2 flt 3 gph 4 qlt");
  });

  it("032:FR-014: a non-terminal prefixes TABS: and carries no escape codes", () => {
    const bar = renderTabBar(fakeCapabilities({ isTTY: false, color: false, columns: 100 }), { active: "graph" });
    expect(bar).toBe("TABS: 1 overview   2 fleet   [3 graph]   4 quality");
  });
});

describe("tabbed frame (feature 032, FR-001)", () => {
  it("032:FR-001: the dashboard opens on overview with the tab bar above the existing overview", () => {
    const d = tabData();
    const out = frame(d, initOverviewTui());
    const lines = out.split("\n");
    expect(lines[0]).toContain("[1 overview]");
    expect(out).toContain("1-4 tab");
  });

  it("032:FR-001: each tab shows only its own body and marks itself active", () => {
    const d = tabData();
    const fleet = frame(d, press(d, initOverviewTui(), "2"));
    expect(fleet.split("\n")[0]).toContain("[2 fleet]");
    expect(fleet).toContain("lane-1-2");
    const graph = frame(d, press(d, initOverviewTui(), "3"));
    expect(graph.split("\n")[0]).toContain("[3 graph]");
    expect(graph).toContain("Dependency graph");
    const quality = frame(d, press(d, initOverviewTui(), "4"));
    expect(quality.split("\n")[0]).toContain("[4 quality");
    expect(quality).toContain("QUALITY");
  });

  it("032:FR-001: without tab mode the screens render exactly as before (no tab bar)", () => {
    const d = tabData({ tabs: undefined });
    expect(frame(d, initOverviewTui())).not.toContain("[1 overview]");
  });
});

describe("empty tabs (feature 032, FR-002)", () => {
  it("032:FR-002: the overview with no features says so and how to start", () => {
    const d = tabData({ features: [] });
    const out = frame(d, initOverviewTui());
    expect(out).toContain("No features yet.");
    expect(out).toContain("Run ambykit init, then /amby.specify.");
  });

  it("032:FR-002: the fleet tab with no run says so and how to start one", () => {
    const d = tabData({ fleet: null });
    const out = frame(d, press(d, initOverviewTui(), "2"));
    expect(out).toContain("No fleet run is active.");
    expect(out).toContain("Start one with ambykit run <feature>.");
    expect(out).toContain("1 back to overview");
  });

  it("032:FR-002: the graph tab with no stories says so and how to add dependencies", () => {
    const d = tabData({ features: [] });
    const out = frame(d, press(d, initOverviewTui(), "3"));
    expect(out).toContain("No story dependencies yet.");
    expect(out).toContain("Add depends-on to stories, or run ambykit graph.");
  });

  it("032:FR-002: the quality tab with no coverage and no findings says so and how to get data", () => {
    const d = tabData({ features: [] });
    const out = frame(d, press(d, initOverviewTui(), "4"));
    expect(out).toContain("No coverage data yet.");
    expect(out).toContain("Run ambykit trace <feature> after tests exist.");
  });

  it("032:FR-002: an empty tab is plain lines on a non-terminal", () => {
    const d = tabData({ fleet: null });
    const out = stripAnsi(renderOverviewTui(fakeCapabilities({ isTTY: false, color: false, columns: 100 }), d, press(d, initOverviewTui(), "2")));
    expect(out).toContain("FLEET\nNo fleet run is active.");
  });
});

describe("FLOW metrics panel (feature 032, US-4)", () => {
  const panel = (s: MetricsState | undefined, c = caps) => stripAnsi(renderMetricsPanel(c, s).join("\n"));

  it("032:FR-007: shows cycle time per phase with the typical value and the longest features, and the converge gap trend", () => {
    const out = panel(ready());
    expect(out).toContain("FLOW · from git history · 4 spec cycles · 5 converge runs");
    expect(out).toMatch(/spec\s+1h 40m/);
    expect(out).toMatch(/plan\s+3h 10m/);
    expect(out).toContain("014 3h 12m");
    expect(out).toContain("CONVERGE GAP RATE");
    expect(out).toContain("latest 0.12 (3 gap tasks / 25 requirements)");
    expect(out).toContain("trend ↓ improving");
    expect(out).toContain("011 0.30");
  });

  it("032:FR-007: a phase with no completed cycle says so instead of a number", () => {
    expect(panel(ready())).toMatch(/converge\s+—\s+no completed cycle yet/);
  });

  it("032:FR-008: with too little history it says so and shows no numbers", () => {
    const out = panel(ready(metrics({ enough: false, reason: "too-little-history", phases: [], gap: [] })));
    expect(out).toContain("Not enough history for metrics yet: only 0 features have a finished phase.");
    expect(out).not.toContain("CYCLE TIME");
  });

  it("032:FR-008: names the reason when there is no repository or no git", () => {
    expect(panel(ready(metrics({ enough: false, reason: "not-a-repo" })))).toContain("Not a git repository, so there is no history to read.");
    expect(panel(ready(metrics({ enough: false, reason: "git-missing" })))).toContain("git is not available, so metrics cannot be computed.");
  });

  it("032:FR-007: loading and failed are states of the panel, not exceptions", () => {
    expect(panel({ status: "loading" })).toContain("reading history…");
    expect(panel({ status: "failed" })).toContain("could not read metrics");
    expect(renderMetricsPanel(caps, undefined)).toEqual([]);
  });

  it("032:FR-019: a skipped-revisions note appears when some history could not be read", () => {
    expect(panel(ready(metrics({ skipped: 2 })))).toContain("2 revisions could not be read and were skipped.");
    expect(panel(ready())).not.toContain("skipped");
  });

  it("032:FR-012: narrow shows one metric per row with no bars and no longest list", () => {
    const out = panel(ready(), fakeCapabilities({ color: false, columns: 50 }));
    expect(out).toMatch(/spec\s+1h 40m typical/);
    expect(out).toMatch(/gap rate\s+0.12 now, ↓ improving/);
    expect(out).not.toContain("014 3h 12m");
    expect(out).not.toContain("█");
  });

  it("032:FR-012: plain and ASCII use #, . and words instead of glyphs", () => {
    const out = panel(ready(), fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 100 }));
    expect(out).toContain("#");
    expect(out).toContain("trend down improving");
    expect(out).not.toMatch(/[█░▁▂▃▄▅▆▇↓]/);
  });

  it("032:FR-007: duration is minutes, hours and minutes, or days and hours, never seconds", () => {
    expect(formatDuration(30_000)).toBe("<1m");
    expect(formatDuration(5 * 60_000)).toBe("5m");
    expect(formatDuration(100 * 60_000)).toBe("1h 40m");
    expect(formatDuration((3 * 24 + 4) * 3_600_000)).toBe("3d 4h");
  });

  it("032:FR-007: the trend is a 10% move from the median of the earlier runs", () => {
    expect(gapTrend([gap("a", 0.3), gap("b", 0.2), gap("c", 0.15)])).toBe("improving");
    expect(gapTrend([gap("a", 0.1), gap("b", 0.1), gap("c", 0.2)])).toBe("worsening");
    expect(gapTrend([gap("a", 0.1), gap("b", 0.1), gap("c", 0.105)])).toBe("flat");
    expect(gapTrend([gap("a", 0.1)])).toBe("flat");
  });

  it("032:FR-007: the sparkline scales to the largest rate and has an ASCII form", () => {
    expect(sparkline(caps, [0, 0.5, 1])).toBe("▁▅█");
    expect(sparkline(fakeCapabilities({ unicode: false }), [0, 1])).toMatch(/^[_.\-=]+$/);
  });

  it("032:FR-016: the panel text names no model, network or path", () => {
    const out = panel(ready());
    expect(out).not.toMatch(/https?:|claude|gpt|model|\.amby|\/Users\/|[A-Z]:\\/i);
  });

  it("032:FR-007: the quality tab hosts the panel below the coverage and findings", () => {
    const d = tabData({ metricsState: ready() });
    const out = frame(d, press(d, initOverviewTui(), "4"));
    expect(out.indexOf("QUALITY")).toBeLessThan(out.indexOf("FLOW"));
    expect(out).toContain("CONVERGE GAP RATE");
  });

  it("032:FR-007: the other tabs do not show the panel", () => {
    const d = tabData({ metricsState: ready() });
    expect(frame(d, initOverviewTui())).not.toContain("FLOW");
    expect(frame(d, press(d, initOverviewTui(), "3"))).not.toContain("FLOW");
  });
});

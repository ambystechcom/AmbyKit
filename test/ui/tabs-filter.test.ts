import { describe, expect, it } from "vitest";
import { KEY_MAP } from "../../src/cli/ui/dashboard/help-overlay.js";
import { renderFilterLine } from "../../src/cli/ui/dashboard/tab-frame.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { featureOf, fleetsOf, lane, tabData, threeFeatureFleet } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/**
 * Feature 032, US-3 and FR-006: one shared filter line under the tab bar, applied to the active tab's list and kept when
 * the tab changes; plus the tab badges (US-1) and the help rows (FR-004) that go with the shared keys.
 */

const caps = fakeCapabilities({ color: false, columns: 120 });
type K = string | { name?: string; sequence?: string };
const key = (k: K) => (typeof k === "string" ? { name: k, sequence: k.length === 1 ? k : undefined } : k);
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: K[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, key(k)), s);
const type = (d: OverviewTuiData, s: OverviewTuiState, text: string) => press(d, s, "/", ...text.split(""), "return");
const frame = (d: OverviewTuiData, s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, d, s));
const bar = (out: string) => out.split("\n").slice(0, 2).join("\n");

describe("the shared filter line (feature 032, FR-006)", () => {
  it("032:FR-006: is absent until a search or state filter is set", () => {
    expect(renderFilterLine(caps, { text: "", label: "/", typing: false, shown: 3, total: 3 })).toBe("");
    const d = tabData();
    expect(frame(d, initOverviewTui()).split("\n")[1]).not.toContain("match");
  });

  it("032:FR-006: while typing it shows the text with a caret and the key row says apply or cancel", () => {
    const d = tabData();
    const typing = press(d, initOverviewTui(), "/", "0", "1");
    const out = frame(d, typing);
    expect(out.split("\n")[1]).toMatch(/\/ 01▌/);
    expect(out.split("\n").at(-1)).toMatch(/⏎ apply\s+esc cancel/);
  });

  it("032:FR-006: applied, it shows the text, the state, how many items match and how to clear it", () => {
    const d = tabData();
    const out = frame(d, type(d, initOverviewTui(), "01"));
    expect(out.split("\n")[1]).toMatch(/\/ 01\s+s state: all\s+\d+ of \d+ match\s+esc clear/);
  });

  it("032:FR-006: s cycles the state filter and names it on the line", () => {
    const d = tabData();
    const out = frame(d, press(d, initOverviewTui(), "s"));
    expect(out.split("\n")[1]).toMatch(/s state: draft/);
  });

  it("032:FR-006: a filter that matches nothing says so and how to clear it, then esc restores the list", () => {
    const d = tabData();
    const none = type(d, initOverviewTui(), "zzzz");
    const out = frame(d, none);
    expect(out).toContain('Nothing matches "zzzz". Press esc to clear.');
    expect(out.split("\n")[1]).toContain("0 of");
    expect(out.split("\n")[1]).toContain("nothing matches");
    const cleared = press(d, none, "escape");
    expect(cleared.filters).toEqual({});
    expect(frame(d, cleared)).not.toContain("Nothing matches");
  });

  it("032:FR-006: the filter is kept when the tab changes and applies to the new tab's list", () => {
    const d = tabData({ fleets: threeFeatureFleet() });
    const s = type(d, initOverviewTui(), "codex");
    const fleet = press(d, s, "2");
    expect(fleet.filters.search).toBe("codex");
    const out = frame(d, fleet);
    expect(bar(out)).toContain("[2 fleet");
    expect(out).toContain("031-multi-feature-fleets");
    expect(out).toContain("lane-1-2");
    expect(out).not.toContain("030-spec-v2-and-migrate");
    expect(out.split("\n")[1]).toMatch(/2 of 6 match/);
  });

  it("032:FR-006: on the fleet tab, / and s work, and a search with no match shows the no-match body", () => {
    const d = tabData({ fleets: threeFeatureFleet() });
    const open = press(d, initOverviewTui(), "2");
    const typed = type(d, open, "nothing-here");
    expect(typed.view).toBe("fleet");
    expect(frame(d, typed)).toContain('Nothing matches "nothing-here". Press esc to clear.');
    const states = press(d, open, "s", "s", "s"); // draft, ready, in-progress (= working)
    expect(states.filters.status).toBe("in-progress");
    expect(frame(d, states)).toContain("lane-1-1");
  });

  it("032:FR-006: esc on the fleet tab clears the filter first and only then goes back", () => {
    const d = tabData({ fleets: threeFeatureFleet() });
    const filtered = type(d, press(d, initOverviewTui(), "2"), "codex");
    const first = press(d, filtered, "escape");
    expect(first.view).toBe("fleet");
    expect(first.filters).toEqual({});
    expect(press(d, first, "escape").view).toBe("overview");
  });

  it("032:FR-006: a single-run fleet narrows its lanes by name or assistant", () => {
    const d = tabData();
    const out = frame(d, type(d, press(d, initOverviewTui(), "2"), "codex"));
    expect(out).toContain("lane-1-2");
    expect(out).not.toContain("lane-1-1");
  });

  it("032:FR-006: on the graph tab, search narrows the stories and the cursor stays inside the list", () => {
    const d = tabData();
    const all = frame(d, press(d, initOverviewTui(), "3"));
    const rows = (all.match(/^> |^  \d+:US-\d+/gm) ?? []).length;
    expect(rows).toBeGreaterThan(0);
    const narrowed = type(d, press(d, initOverviewTui(), "3"), "US-1");
    expect(narrowed.view).toBe("graph");
    const out = frame(d, narrowed);
    expect(out.split("\n")[1]).toMatch(/\/ US-1/);
    expect(narrowed.graph!.cursor).toBe(0);
  });

  it("032:FR-006: on the quality tab, the same filter narrows the features", () => {
    const d = tabData();
    const out = frame(d, type(d, press(d, initOverviewTui(), "4"), "01"));
    expect(out.split("\n")[1]).toMatch(/\/ 01\s+s state: all\s+\d+ of \d+ match/);
  });
});

describe("tab badges (feature 032, US-1)", () => {
  it("032:FR-001: the fleet tab is badged when a lane is stalled or blocked, and not otherwise", () => {
    const calm = tabData({ fleets: fleetsOf([featureOf("030-a", "running", [lane("lane-1-1")]), featureOf("031-b", "waiting")]), fleet: null });
    expect(bar(frame(calm, initOverviewTui()))).not.toContain("fleet ●");
    expect(bar(frame(tabData({ fleets: threeFeatureFleet() }), initOverviewTui()))).toContain("fleet ●");
  });

  it("032:FR-001: a paused feature badges the fleet tab", () => {
    const d = tabData({ fleet: null, fleets: fleetsOf([featureOf("030-a", "paused", [lane("lane-1-1", "paused")]), featureOf("031-b", "waiting")]) });
    expect(bar(frame(d, initOverviewTui()))).toContain("fleet ●");
  });
});

describe("help rows for the shared keys (feature 032, FR-004)", () => {
  it("032:FR-004: the fleet, graph and quality screens list search and state; the fleet lists collapse", () => {
    const text = (s: keyof typeof KEY_MAP) => KEY_MAP[s].map(([, , label]) => label).join("\n");
    expect(text("fleet")).toMatch(/search lanes/);
    expect(text("fleet")).toMatch(/collapse \/ expand a feature/);
    expect(text("graph")).toMatch(/search stories/);
    expect(text("quality")).toMatch(/search features/);
    for (const s of ["fleet", "graph", "quality"] as const) expect(text(s)).toMatch(/cycle the state filter/);
  });

  it("032:FR-004: ? opens the overlay on the quality tab and any key closes it; a key that means nothing changes nothing", () => {
    const d = tabData();
    const quality = press(d, initOverviewTui(), "4");
    const help = press(d, quality, { name: "?", sequence: "?" });
    expect(help.help).toBe(true);
    expect(frame(d, help)).toContain("KEYS · quality");
    expect(press(d, help, "x").help).toBe(false);
    expect(press(d, quality, "x")).toEqual(quality);
    expect(press(d, quality, "escape")).toMatchObject({ quality: false });
  });
});

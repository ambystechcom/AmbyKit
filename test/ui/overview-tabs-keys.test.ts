import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { fleetViewApi } from "../../src/cli/ui/dashboard/fleet-view.js";
import { graphViewApi } from "../../src/cli/ui/dashboard/graph-view.js";
import { helpLines, KEY_MAP, type HelpScreen } from "../../src/cli/ui/dashboard/help-overlay.js";
import { runFullscreen } from "../../src/cli/ui/interactive/fullscreen.js";
import {
  initOverviewTui,
  isOverviewDone,
  reduceOverviewTui,
  renderOverviewTui,
  tabOf,
  type OverviewTuiData,
  type OverviewTuiState,
} from "../../src/cli/ui/interactive/overview.js";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fleetView } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/** Feature 032, US-2: switch tabs, move, open a detail, go back and quit with keys only; help lists the keys. */

const { features, issues } = readFeatures(dashboardFixture());
const data: OverviewTuiData = {
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.6.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
  graphView: graphViewApi,
  fleetView: fleetViewApi,
  fleet: fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2" }]),
  rows: 24,
};
const caps = fakeCapabilities({ color: false, columns: 100 });
type K = string | { name?: string; sequence?: string; shift?: boolean; ctrl?: boolean };
const key = (k: K) => (typeof k === "string" ? (k.length === 1 && !/[a-z]/.test(k) ? { name: k, sequence: k } : { name: k, sequence: k.length === 1 ? k : undefined }) : k);
const press = (s: OverviewTuiState, ...keys: K[]) => keys.reduce((st, k) => reduceOverviewTui(data, st, key(k)), s);
const render = (s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, data, s));

describe("tabs and keys (feature 032, US-2)", () => {
  it("032:FR-004: a keys-only tour: change tab, move, open a detail, go back, quit", () => {
    let s = initOverviewTui();
    expect(tabOf(s)).toBe("overview");
    s = press(s, "2");
    expect(tabOf(s)).toBe("fleet");
    expect(s.view).toBe("fleet");
    s = press(s, "3");
    expect(tabOf(s)).toBe("graph");
    s = press(s, "4");
    expect(tabOf(s)).toBe("quality");
    expect(s.quality).toBe(true);
    s = press(s, "1");
    expect(tabOf(s)).toBe("overview");
    s = press(s, "down", "return"); // open the attention item's feature
    expect(s.view).toBe("feature");
    s = press(s, "return"); // story detail
    expect(s.story?.mode).toBe("detail");
    s = press(s, "escape", "escape");
    expect(s.view).toBe("overview");
    s = press(s, "q");
    expect(isOverviewDone(s)).toBe(true);
  });

  it("032:FR-004: ] and [ move to the next and previous tab and wrap", () => {
    let s = press(initOverviewTui(), "]");
    expect(tabOf(s)).toBe("fleet");
    s = press(s, "]", "]", "]");
    expect(tabOf(s)).toBe("overview");
    expect(tabOf(press(initOverviewTui(), "["))).toBe("quality");
  });

  it("032:FR-004: tab keys work from the feature view and from the quality tab, and 1 returns to the overview", () => {
    const feature = press(initOverviewTui(), "return");
    expect(feature.view).toBe("feature");
    expect(tabOf(press(feature, "3"))).toBe("graph");
    expect(press(feature, "1")).toMatchObject({ view: "overview", feature: null });
    const quality = press(initOverviewTui(), "4");
    expect(tabOf(press(quality, "2"))).toBe("fleet");
  });

  it("032:FR-004: a tab whose view is not available leaves the state unchanged", () => {
    const bare: OverviewTuiData = { ...data, graphView: undefined, fleetView: undefined };
    const s = initOverviewTui();
    expect(reduceOverviewTui(bare, s, { name: "3", sequence: "3" })).toBe(s);
    expect(reduceOverviewTui(bare, s, { name: "2", sequence: "2" })).toBe(s);
  });

  it("032:FR-004: a key with no meaning changes nothing", () => {
    const s = initOverviewTui();
    for (const k of ["z", "5", "0", "x"]) expect(press(s, k)).toEqual(s);
    const feature = press(s, "return");
    expect(press(feature, "z")).toEqual(feature);
  });

  it("032:FR-004: tab and shift-tab still move panel focus in the overview", () => {
    expect(press(initOverviewTui(), "tab").focus).toBe(1);
    expect(press(initOverviewTui(), { name: "tab", shift: true }).focus).toBe(3);
  });

  it("032:FR-004: typing in the search field is not a tab switch", () => {
    const typing = press(initOverviewTui(), "f");
    expect(typing.input).toBe("");
    const out = press(typing, "1", "]", "2");
    expect(out.input).toBe("1]2");
    expect(tabOf(out)).toBe("overview");
  });

  it("032:FR-004: help lists the tab keys, search and quit on every screen, from one key map", () => {
    for (const screen of Object.keys(KEY_MAP) as HelpScreen[]) {
      const text = stripAnsi(helpLines(caps, screen).join("\n"));
      expect(text, screen).toContain("switch tab");
      expect(text, screen).toContain("quit");
    }
    expect(stripAnsi(helpLines(caps, "overview").join("\n"))).toMatch(/\/\s+search feature names/);
    const open = render(press(initOverviewTui(), { name: "?", sequence: "?" }));
    expect(open).toContain("KEYS");
    expect(open).toContain("1-4");
  });
});

const ESC = "\x1b";
const EXIT = `${ESC}[?25h${ESC}[?1049l`;

function terminal() {
  const written: string[] = [];
  const raw: boolean[] = [];
  const output = Object.assign(new EventEmitter(), { columns: 100, write: (s: string) => (written.push(s), true) });
  const input = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false, setRawMode: (m: boolean) => void raw.push(m), resume: () => {}, pause: () => {} }) as unknown as NodeJS.ReadStream;
  return { written, raw, output, input, all: () => written.join("") };
}

const app = (throwOn?: "reduce") => ({
  initial: initOverviewTui(),
  render: (s: OverviewTuiState) => renderOverviewTui(caps, data, s),
  reduce: (s: OverviewTuiState, k: Parameters<typeof reduceOverviewTui>[2]) => {
    if (throwOn === "reduce" && k.sequence === "3") throw new Error("boom");
    return reduceOverviewTui(data, s, k);
  },
  isDone: isOverviewDone,
});

describe("the terminal is restored on the tabbed app (feature 032, FR-005)", () => {
  it("032:FR-005: quit restores the screen, raw mode and listeners after tabs were used", async () => {
    const t = terminal();
    const done = runFullscreen(app(), { input: t.input, output: t.output });
    t.input.emit("keypress", "2", { name: "2", sequence: "2" });
    t.input.emit("keypress", "q", { name: "q", sequence: "q" });
    await done;
    expect(t.all()).toContain(EXIT);
    expect(t.raw).toEqual([true, false]);
    expect(t.input.listenerCount("keypress")).toBe(0);
  });

  it("032:FR-005: an interrupt (Ctrl-C) in the graph tab restores the terminal", async () => {
    const t = terminal();
    const done = runFullscreen(app(), { input: t.input, output: t.output });
    t.input.emit("keypress", "3", { name: "3", sequence: "3" });
    t.input.emit("keypress", "", { name: "c", ctrl: true });
    await done;
    expect(t.all()).toContain(EXIT);
    expect(t.raw).toEqual([true, false]);
  });

  it("032:FR-005: an error while switching tabs restores the terminal and then rejects", async () => {
    const t = terminal();
    const done = runFullscreen(app("reduce"), { input: t.input, output: t.output });
    t.input.emit("keypress", "3", { name: "3", sequence: "3" });
    await expect(done).rejects.toThrow("boom");
    expect(t.all()).toContain(EXIT);
    expect(t.raw).toEqual([true, false]);
  });
});

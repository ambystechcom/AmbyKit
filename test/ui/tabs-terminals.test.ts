import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { effectiveColumns, tabLayout } from "../../src/cli/ui/dashboard/layout.js";
import { runFullscreen } from "../../src/cli/ui/interactive/fullscreen.js";
import { initOverviewTui, isOverviewDone, reduceOverviewTui, renderOverviewTui, type MetricsState, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import type { Metrics } from "../../src/core/metrics/types.js";
import { featureOf, fleetsOf, lane, tabData } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** Feature 032, US-6: narrow, no color, no icons, each icon mode, resize and piped output on every tab. */

const TABS = ["1", "2", "3", "4"] as const;
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k, sequence: k.length === 1 ? k : undefined }), s);
const metrics: MetricsState = {
  status: "ready",
  metrics: {
    phases: [{ phase: "spec", perFeature: [{ feature: "014-a", phase: "spec", startedAt: 0, completedAt: 3_600_000, ms: 3_600_000 }], typicalMs: 3_600_000 }],
    gap: [
      { feature: "011", commit: "a", time: 0, gapTasks: 3, requirements: 10, rate: 0.3 },
      { feature: "020", commit: "b", time: 0, gapTasks: 1, requirements: 10, rate: 0.1 },
    ],
    skipped: 0,
    enough: true,
  } satisfies Metrics,
};
const data = (): OverviewTuiData =>
  tabData({
    metricsState: metrics,
    fleets: fleetsOf([featureOf("030-a", "running", [lane("lane-1-1"), lane("lane-1-2", "blocked", { stalled: true, idleMinutes: 20 })]), featureOf("031-b", "waiting", [], { waitsFor: [{ feature: "030-a", why: "depends-on" }] })]),
  });
const open = (d: OverviewTuiData, tab: string) => press(d, initOverviewTui(), tab);

describe("narrow terminals (feature 032, FR-012)", () => {
  const narrow = fakeCapabilities({ color: false, columns: 50 });

  it("032:FR-012: on every tab the tab bar is one short line and the key row is the short form", () => {
    const d = data();
    for (const k of TABS) {
      const out = stripAnsi(renderOverviewTui(narrow, d, open(d, k)));
      const lines = out.split("\n");
      expect(lines[0], k).toMatch(/^\[?\d (ovw|flt|gph|qlt)\]?( \d (ovw|flt|gph|qlt)\]?)*/);
      expect(lines[0]!.length, k).toBeLessThanOrEqual(50);
      expect(lines.at(-1), k).toContain("1-4 tab");
      expect(lines.at(-1), k).toContain("? help");
    }
  });

  it("032:FR-012: the grouped fleet and the FLOW panel adapt (no cut state words, no bars)", () => {
    const d = data();
    const fleet = stripAnsi(renderOverviewTui(narrow, d, open(d, "2")));
    expect(fleet).toContain("blocked");
    expect(fleet).toContain("STALLED");
    const quality = stripAnsi(renderOverviewTui(narrow, d, open(d, "4")));
    expect(quality).toMatch(/gap rate\s+0.10 now/);
    expect(quality).not.toContain("█");
  });

  it("032:FR-012: 60 columns is the one breakpoint for every tab", () => {
    expect(tabLayout(fakeCapabilities({ columns: 59 }))).toBe("narrow");
    expect(tabLayout(fakeCapabilities({ columns: 60 }))).toBe("wide");
  });

  it("032:FR-014: a terminal that reports no size is laid out at 80 columns", () => {
    expect(effectiveColumns(fakeCapabilities({ columns: 0 }))).toBe(80);
    expect(effectiveColumns(fakeCapabilities({ columns: Number.NaN }))).toBe(80);
    const d = data();
    const out = stripAnsi(renderOverviewTui(fakeCapabilities({ color: false, columns: 0 }), d, open(d, "1")));
    expect(out.split("\n")[0]).toContain("[1 overview]");
  });
});

describe("no color and no icons (feature 032, FR-012, FR-013)", () => {
  it("032:FR-012: with color off no tab emits an escape code, and every state is still a word", () => {
    const d = data();
    const caps = fakeCapabilities({ color: false, columns: 120 });
    for (const k of TABS) expect(hasAnsi(renderOverviewTui(caps, d, open(d, k))), k).toBe(false);
    const fleet = renderOverviewTui(caps, d, open(d, "2"));
    for (const word of ["working", "blocked", "STALLED", "waiting"]) expect(fleet).toContain(word);
  });

  it("032:FR-012: without unicode the new surfaces use only ASCII", () => {
    const d = data();
    const caps = fakeCapabilities({ color: false, unicode: false, columns: 120 });
    for (const k of ["2", "4"]) {
      const out = renderOverviewTui(caps, d, open(d, k));
      expect(out, k).toMatch(/^[\x20-\x7e\n]*$/);
    }
  });

  it("032:FR-013: --icons=ascii switches the new glyphs on a unicode terminal; unicode and nerd keep the unicode set", () => {
    const d = data();
    const base = { color: false, columns: 120 } as const;
    const ascii = stripAnsi(renderOverviewTui(fakeCapabilities({ ...base, icons: "ascii" }), d, open(d, "2")));
    expect(ascii).toContain("[>]");
    expect(ascii).toContain("v 030-a");
    expect(ascii).not.toContain("▶");
    for (const icons of [undefined, "nerd"] as const) {
      const out = stripAnsi(renderOverviewTui(fakeCapabilities({ ...base, ...(icons ? { icons } : {}) }), d, open(d, "2")));
      expect(out, String(icons)).toContain("▶");
      expect(out, String(icons)).toContain("▾ 030-a");
    }
  });

  it("032:FR-013: the tab badge and the FLOW glyphs follow the icon mode too", () => {
    const d = data();
    const asciiBar = stripAnsi(renderOverviewTui(fakeCapabilities({ color: false, columns: 120, icons: "ascii" }), d, open(d, "1"))).split("\n")[0]!;
    expect(asciiBar).toContain("fleet *");
    const flow = stripAnsi(renderOverviewTui(fakeCapabilities({ color: false, columns: 120, icons: "ascii" }), d, open(d, "4")));
    expect(flow).toContain("trend down improving");
  });
});

describe("resize and piped output (feature 032, FR-014)", () => {
  const terminal = () => {
    const written: string[] = [];
    const output = Object.assign(new EventEmitter(), { columns: 120, write: (s: string) => (written.push(s), true) });
    const input = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false, setRawMode: () => {}, resume: () => {}, pause: () => {} }) as unknown as NodeJS.ReadStream;
    return { written, output, input };
  };

  it("032:FR-014: a resize re-flows the tab frame to the new width and keeps the active tab", async () => {
    const d = data();
    let caps = fakeCapabilities({ color: false, columns: 120 });
    const t = terminal();
    const done = runFullscreen(
      {
        initial: initOverviewTui(),
        render: (s: OverviewTuiState) => renderOverviewTui(caps, d, s),
        reduce: (s: OverviewTuiState, k: Parameters<typeof reduceOverviewTui>[2]) => reduceOverviewTui(d, s, k),
        isDone: isOverviewDone,
        resize: (columns: number) => {
          caps = { ...caps, columns };
        },
      },
      { input: t.input, output: t.output },
    );
    t.input.emit("keypress", "3", { name: "3", sequence: "3" });
    t.output.columns = 50;
    t.output.emit("resize");
    t.input.emit("keypress", "q", { name: "q", sequence: "q" });
    await done;
    const all = stripAnsi(t.written.join(""));
    expect(all).toContain("[3 graph]");
    expect(all).toContain("[3 gph]");
  });

  it("032:FR-014: piped output is plain: TABS:, no escape codes, no box drawing", () => {
    const d = data();
    const caps = fakeCapabilities({ isTTY: false, color: false, columns: 100 });
    for (const k of TABS) {
      const out = renderOverviewTui(caps, d, open(d, k));
      expect(out.split("\n")[0], k).toMatch(/^TABS: /);
      expect(hasAnsi(out), k).toBe(false);
      expect(out, k).not.toMatch(/[┏┓┗┛┃━╭╮╰╯│─]/);
    }
  });
});

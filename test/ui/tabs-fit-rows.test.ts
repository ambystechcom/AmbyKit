import { describe, expect, it } from "vitest";
import { fitBodyToRows } from "../../src/cli/ui/dashboard/tab-frame.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { features, tabData } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/**
 * Feature 032 flicker fix: a frame taller than the terminal scrolls the alternate screen on every repaint, which flickers
 * and pushes the tab bar off the top. The tabbed frame must never draw more rows than the terminal has.
 */

const caps = fakeCapabilities({ color: false, columns: 100 });
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const num = String(100 + i);
    return { ...features[0]!, name: `${num}-feature-${i}`, ref: num };
  });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k, sequence: k.length === 1 ? k : undefined }), s);
const lines = (d: OverviewTuiData, s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, d, s)).split("\n");

describe("the tabbed frame fits the terminal height (032:FR-014)", () => {
  const data = tabData({ features: many(60), rows: 30 });

  it("032:FR-014: never draws more rows than the terminal has, with the tab bar on the first row", () => {
    const out = lines(data, initOverviewTui());
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out[0]).toContain("[1 overview]");
    expect(out.join("\n")).toContain("1-4 tab");
  });

  it("032:FR-014: marks what is hidden, and keeps the cursor row on screen as it moves down", () => {
    let s = press(data, initOverviewTui(), "tab"); // focus a list
    const seen = new Set<string>();
    for (let i = 0; i < 70; i++) {
      s = press(data, s, "down");
      const out = lines(data, s);
      expect(out.length).toBeLessThanOrEqual(30);
      expect(out[0]).toContain("[1 overview]");
      seen.add(out.join("\n").includes("more below") ? "below" : "none");
      seen.add(out.join("\n").includes("more above") ? "above" : "none");
    }
    expect(seen.has("below") || seen.has("above")).toBe(true);
  });

  it("032:FR-014: a terminal tall enough shows everything with no markers", () => {
    const out = lines(tabData({ features: many(3), rows: 80 }), initOverviewTui());
    expect(out.join("\n")).not.toMatch(/more (above|below)/);
  });

  it("032:FR-014: without a terminal height nothing is cut", () => {
    const { rows: _omit, ...rest } = tabData({ features: many(60) });
    const out = lines(rest as OverviewTuiData, initOverviewTui());
    expect(out.length).toBeGreaterThan(30);
    expect(out.join("\n")).not.toMatch(/more (above|below)/);
  });
});

describe("fitBodyToRows", () => {
  const body = Array.from({ length: 40 }, (_, i) => `  row ${i}`);

  it("returns the body unchanged when it fits", () => {
    expect(fitBodyToRows(caps, body.slice(0, 10), 10)).toEqual(body.slice(0, 10));
  });

  it("shows the top with a 'more below' row when there is no cursor", () => {
    const out = fitBodyToRows(caps, body, 12);
    expect(out).toHaveLength(12);
    expect(out[0]).toBe("  row 0");
    expect(out[11]).toContain("28 more below");
  });

  it("windows around the cursor row and marks both sides", () => {
    const withCursor = body.map((l, i) => (i === 25 ? "┃ ▸ row 25" : l));
    const out = fitBodyToRows(caps, withCursor, 12);
    expect(out).toHaveLength(12);
    expect(out.join("\n")).toContain("▸ row 25");
    expect(out[0]).toContain("more above");
    expect(out[11]).toContain("more below");
  });

  it("shows the end of the list without a 'below' row when the cursor is last", () => {
    const withCursor = body.map((l, i) => (i === 39 ? "▸ row 39" : l));
    const out = fitBodyToRows(caps, withCursor, 12);
    expect(out.at(-1)).toBe("▸ row 39");
    expect(out.join("\n")).not.toContain("more below");
  });
});

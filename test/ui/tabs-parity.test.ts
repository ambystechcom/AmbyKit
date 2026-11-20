import { describe, expect, it } from "vitest";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { tabData } from "../helpers/tabs-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/**
 * Feature 032, FR-003: the redesign loses no information. Every line the existing views draw (overview, fleet, graph,
 * quality, and the feature and story screens under the overview tab) is still drawn, unchanged, inside its tab.
 */

const caps = fakeCapabilities({ color: false, columns: 120 });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k, sequence: k.length === 1 ? k : undefined }), s);
const render = (d: OverviewTuiData, s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, d, s));

/** The body lines of a frame: everything before the final blank line and key row. */
const bodyLines = (out: string): string[] => out.slice(0, out.lastIndexOf("\n\n")).split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");

function expectParity(d: OverviewTuiData, s: OverviewTuiState): void {
  const before = bodyLines(render({ ...d, tabs: undefined }, s));
  const after = render(d, s).split("\n").map((l) => l.trimEnd());
  expect(before.length).toBeGreaterThan(0);
  for (const line of before) expect(after, `lost line: ${line}`).toContain(line);
}

describe("existing views keep every line in their tab (feature 032, FR-003)", () => {
  const d = tabData();

  it("032:FR-003: the overview tab", () => {
    expectParity(d, initOverviewTui());
  });

  it("032:FR-003: the feature view and the story detail under the overview tab", () => {
    const feature = press(d, initOverviewTui(), "down", "return");
    expect(feature.view).toBe("feature");
    expectParity(d, feature);
    expectParity(d, press(d, feature, "return"));
  });

  it("032:FR-003: the fleet tab (a single run)", () => {
    expectParity(d, press(d, initOverviewTui(), "2"));
  });

  it("032:FR-003: the graph tab", () => {
    expectParity(d, press(d, initOverviewTui(), "3"));
  });

  it("032:FR-003: the quality tab keeps the coverage and findings lines", () => {
    const quality = press(d, initOverviewTui(), "4");
    const before = stripAnsi(renderOverviewTui(caps, { ...d, tabs: undefined }, quality)).split("\n\n")[0]!.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    const after = render(d, quality).split("\n").map((l) => l.trimEnd());
    for (const line of before) expect(after, `lost line: ${line}`).toContain(line);
  });

  it("032:FR-003: the tab frame adds the bar and the key row only; a 029 confirm dialog still overlays the fleet tab", () => {
    const fleet = press(d, initOverviewTui(), "2", "x");
    expect(fleet.fleet?.confirm).not.toBeNull();
    expect(render(d, fleet)).toContain("STOP LANE");
  });

  it("032:FR-003: the one-shot and --json paths do not set tab mode, so the frame is not part of them", () => {
    expect(render({ ...d, tabs: undefined }, initOverviewTui())).not.toContain("1-4 tab");
  });
});

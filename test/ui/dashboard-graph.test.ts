import { describe, expect, it } from "vitest";
import { buildGraphViewModel, graphViewApi, renderGraphView } from "../../src/cli/ui/dashboard/graph-view.js";
import { helpLines } from "../../src/cli/ui/dashboard/help-overlay.js";
import {
  applyData,
  initOverviewTui,
  reduceOverviewTui,
  renderOverviewTui,
  type OverviewTuiData,
  type OverviewTuiState,
} from "../../src/cli/ui/interactive/overview.js";
import { feature, story } from "../helpers/graph-fixtures.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** US-6 (feature 023): the interactive graph view, as a pure model, a plain-text renderer and reducer keys. */
const features = () => [
  feature("904-base", [
    story("904-base", "US1", { status: "done", title: "Core" }),
    story("904-base", "US2", { title: "Parser" }),
  ]),
  feature("905-top", [
    story("905-top", "US1", { dependsOn: ["904US1"], title: "Command" }),
    story("905-top", "US2", { dependsOn: ["US1", "904US2"], title: "Report" }),
    story("905-top", "US3", { blockedBy: ["US2"], title: "Docs" }),
  ]),
];

const data = (extra: Partial<OverviewTuiData> = {}): OverviewTuiData => ({
  features: features(),
  issues: [],
  meta: { crumb: [], cwd: "~/proj", version: "1.5.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
  graphView: graphViewApi,
  ...extra,
});
const caps = fakeCapabilities({ color: false, columns: 100 });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) =>
  keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k }), s);

describe("graph view model (FR-014)", () => {
  const model = buildGraphViewModel(features());
  it("lists the open stories with buildable or blocked, and their blockers and dependents", () => {
    expect(model.rows.map((r) => r.id)).toEqual(["904:US-2", "905:US-1", "905:US-2", "905:US-3"]);
    const by = Object.fromEntries(model.rows.map((r) => [r.id, r]));
    expect(by["904:US-2"]!.state).toBe("buildable");
    expect(by["905:US-1"]!.state).toBe("buildable"); // its only dependency is done
    expect(by["905:US-2"]!.blockers).toEqual(["905:US-1", "904:US-2"]);
    expect(by["905:US-3"]!.blockers).toEqual(["905:US-2"]);
    expect(by["904:US-2"]!.blocks).toEqual(["905:US-2"]);
    expect(model.buildableCount).toBe(2);
    expect(model.doneCount).toBe(1);
  });
  it("names the critical path in dependency order and marks its rows", () => {
    expect(model.critical).toEqual(["904:US-2", "905:US-2", "905:US-3"]);
    expect(model.rows.filter((r) => r.critical).map((r) => r.id)).toEqual(["904:US-2", "905:US-2", "905:US-3"]);
  });
  it("counts broken edges and cycles as problems", () => {
    const bad = buildGraphViewModel([feature("906-x", [story("906-x", "US1", { dependsOn: ["US9"] })])]);
    expect(bad.problems).toBe(1);
  });
});

describe("graph view rendering (FR-016)", () => {
  const model = buildGraphViewModel(features());
  it("is a plain text list that shows blockers, buildable stories and the critical path", () => {
    const out = renderGraphView(caps, model, 2);
    expect(out).toContain("Dependency graph: 4 open stories, 2 buildable now, 1 done");
    expect(out).toContain("Critical path (3): 904:US-2 -> 905:US-2 -> 905:US-3");
    expect(out).toContain("905:US-1  buildable");
    expect(out).toContain("blocked by 905:US-1, 904:US-2");
    expect(out).toContain("> 905:US-2"); // the cursor row
    expect(out).toContain("905:US-2 - Report");
    expect(out).toContain("blocks:     905:US-3");
  });
  it("needs no color, glyph or frame, and fits a narrow terminal", () => {
    const narrow = fakeCapabilities({ color: false, unicode: false, columns: 40 });
    const out = renderGraphView(narrow, model, 0);
    expect(hasAnsi(out)).toBe(false);
    expect(/^[\x20-\x7e\n]*$/.test(out)).toBe(true);
    for (const line of out.split("\n")) expect(line.length).toBeLessThanOrEqual(40);
  });
  it("says so when nothing is open", () => {
    const done = buildGraphViewModel([feature("907-x", [story("907-x", "US1", { status: "done" })])]);
    expect(renderGraphView(caps, done, 0)).toContain("Nothing open");
  });
  it("scrolls a long list to keep the cursor in view", () => {
    const many = feature("908-long", Array.from({ length: 30 }, (_, i) => story("908-long", `US${i + 1}`)));
    const out = renderGraphView(caps, buildGraphViewModel([many]), 20);
    expect(out).toContain("more above");
    expect(out).toContain("more below");
    expect(out).toContain("> 908:US-21");
  });
});

describe("graph view keys (FR-014)", () => {
  it("g opens the view; esc returns to the overview", () => {
    const d = data();
    const open = press(d, initOverviewTui(), "g");
    expect(open.view).toBe("graph");
    expect(stripAnsi(renderOverviewTui(caps, d, open))).toContain("Critical path (3)");
    expect(press(d, open, "escape").view).toBe("overview");
  });
  it("up and down move over the open stories and wrap", () => {
    const d = data();
    const open = press(d, initOverviewTui(), "g");
    expect(press(d, open, "down").graph?.cursor).toBe(1);
    expect(press(d, open, "up").graph?.cursor).toBe(3);
  });
  it("enter jumps from a story to its feature, with that story selected", () => {
    const d = data();
    const open = press(d, initOverviewTui(), "g", "down", "down"); // 905:US-2
    const jumped = press(d, open, "return");
    expect(jumped.view).toBe("feature");
    expect(jumped.feature).toBe("905-top");
    expect(jumped.story?.stories[jumped.story.cursor]?.displayId).toBe("US-2");
  });
  it("jumping works even when a filter would hide the target feature", () => {
    const d = data();
    const filtered = { ...initOverviewTui({ status: "done" }) };
    const open = press(d, filtered, "g", "down", "down");
    expect(press(d, open, "return").view).toBe("feature");
  });
  it("q quits from the graph view", () => {
    const d = data();
    expect(press(d, press(d, initOverviewTui(), "g"), "q").done).toBe(true);
  });
  it("g does nothing when the view is not provided (one-shot never gets it)", () => {
    const d = data({ graphView: undefined });
    expect(press(d, initOverviewTui(), "g").view).toBe("overview");
    expect(stripAnsi(renderOverviewTui(caps, d, initOverviewTui()))).not.toContain("graph");
  });
  it("a refresh keeps the view and clamps the cursor when stories finish", () => {
    const d = data();
    const open = press(d, initOverviewTui(), "g", "up"); // cursor 3
    const fewer = data({ features: [feature("904-base", [story("904-base", "US1")])] });
    const next = applyData(open, d, fewer);
    expect(next.view).toBe("graph");
    expect(next.graph?.cursor).toBe(0);
  });
});

describe("graph view help (FR-014)", () => {
  it("lists g on the overview screen and has its own keys screen", () => {
    expect(helpLines(caps, "overview").join("\n")).toContain("dependency graph");
    const graph = stripAnsi(helpLines(caps, "graph").join("\n"));
    expect(graph).toContain("open the story's feature");
    expect(graph).toContain("back");
  });
});

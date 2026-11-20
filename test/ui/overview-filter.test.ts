import { describe, expect, it } from "vitest";
import { filterLine, fromFilters, noMatchMessage } from "../../src/cli/ui/dashboard/filter-line.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/** Feature 032, US-3: search by text and ID, filter by state, nothing matches, clear restores the list. */

const { features, issues } = readFeatures(dashboardFixture());
const data: OverviewTuiData = {
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.6.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
};
const caps = fakeCapabilities({ color: false, columns: 100 });
const typed = (text: string) => [...text].map((c) => ({ name: c, sequence: c }));
const send = (s: OverviewTuiState, ...keys: { name?: string; sequence?: string }[]) => keys.reduce((st, k) => reduceOverviewTui(data, st, k), s);
const render = (s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, data, s));
const search = (s: OverviewTuiState, opener: string, text: string) =>
  send(s, { name: opener, sequence: opener }, ...typed(text), { name: "return" });

describe("search and filter on the overview (feature 032, US-3)", () => {
  it("032:FR-006: / opens a search field, and typing part of a feature name shows only the matching features", () => {
    const opened = send(initOverviewTui(), { name: "/", sequence: "/" });
    expect(opened.input).toBe("");
    expect(render(opened)).toContain("search");
    const s = search(initOverviewTui(), "/", "widg");
    expect(s.filters.search).toBe("widg");
    expect(s.filters.feature).toBeUndefined();
    const out = render(s);
    expect(out).toContain("widgets");
    expect(out).not.toContain("core");
    expect(out).toContain("search=widg");
  });

  it("032:FR-006: searching by feature number works (an ID search), by / and by f", () => {
    const bySearch = search(initOverviewTui(), "/", "002");
    expect(render(bySearch)).toContain("widgets");
    expect(render(bySearch)).not.toContain("core");
    const byFilter = search(initOverviewTui(), "f", "002");
    expect(byFilter.filters.feature).toBe("002");
    expect(render(byFilter)).toContain("widgets");
  });

  it("032:FR-006: s cycles the status filter, shows it, and filtering by a state hides the other features", () => {
    const s = send(initOverviewTui(), { name: "s", sequence: "s" });
    expect(s.filters.status).toBe("draft");
    expect(render(s)).toContain("status=draft");
    const again = send(s, ...Array(5).fill({ name: "s", sequence: "s" }));
    expect(again.filters.status).toBe("deferred");
  });

  it("032:FR-006: a search that matches nothing says so and how to clear it", () => {
    const s = search(initOverviewTui(), "/", "zzzz-nothing");
    const out = render(s);
    expect(out).toContain("Nothing matches");
    expect(out).toContain("esc to clear");
  });

  it("032:FR-006: esc clears the filter and the full list returns", () => {
    const filtered = search(initOverviewTui(), "/", "widg");
    const cleared = send(filtered, { name: "escape" });
    expect(cleared.filters).toEqual({});
    expect(render(cleared)).toBe(render(initOverviewTui()));
  });

  it("032:FR-006: the plain filter line names what is applied and how to clear it; empty when nothing is", () => {
    expect(filterLine(fromFilters({}))).toBe("");
    expect(filterLine(fromFilters({ feature: "auth", status: "blocked" }))).toBe('filter: search: "auth" · state: blocked   (esc to clear)');
    expect(noMatchMessage(fromFilters({ feature: "zzz" }))).toContain("esc");
  });
});

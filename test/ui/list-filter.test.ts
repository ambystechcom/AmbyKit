import { describe, expect, it } from "vitest";
import { applyListFilter, cycleState, filterText, isActive, noMatchText, NO_FILTER, type Filterable } from "../../src/cli/ui/interactive/list-filter.js";

const items: Filterable[] = [
  { id: "012-worktree-isolation", title: "Worktree isolation", state: "done" },
  { id: "023-dependency-graph", title: "Dependency graph", state: "in-progress" },
  { id: "031-multi-feature-fleets", title: "Multi-feature fleets", state: "blocked" },
];

describe("list filter slice (feature 032, US-3)", () => {
  it("032:FR-006: searches by text and by id, case-insensitively", () => {
    expect(applyListFilter(items, { query: "GRAPH" }).map((i) => i.id)).toEqual(["023-dependency-graph"]);
    expect(applyListFilter(items, { query: "031" }).map((i) => i.id)).toEqual(["031-multi-feature-fleets"]);
  });

  it("032:FR-006: filters by state and combines with a search", () => {
    expect(applyListFilter(items, { query: "", state: "blocked" }).map((i) => i.id)).toEqual(["031-multi-feature-fleets"]);
    expect(applyListFilter(items, { query: "graph", state: "blocked" })).toEqual([]);
  });

  it("032:FR-006: shows the active filter and says how to clear one that matches nothing", () => {
    const f = { query: "zzz", state: "done" };
    expect(filterText(f)).toBe('search: "zzz" · state: done');
    expect(applyListFilter(items, f)).toEqual([]);
    expect(noMatchText(f)).toContain("esc");
  });

  it("032:FR-006: clearing the filter restores the full list", () => {
    expect(isActive(NO_FILTER)).toBe(false);
    expect(filterText(NO_FILTER)).toBe("");
    expect(applyListFilter(items, NO_FILTER)).toHaveLength(3);
  });

  it("032:FR-006: the state filter cycles through the given states and back to every state", () => {
    const cycle = [undefined, "blocked", "done"];
    let f = cycleState(NO_FILTER, cycle);
    expect(f.state).toBe("blocked");
    f = cycleState(f, cycle);
    expect(f.state).toBe("done");
    expect(cycleState(f, cycle).state).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/core/graph.js";
import { blockersOf, buildable, criticalPath } from "../../src/core/graph-paths.js";
import { feature, story } from "../helpers/graph-fixtures.js";

const ids = (nodes: { id: string }[]): string[] => nodes.map((n) => n.id);

describe("buildable (FR-012)", () => {
  it("returns the not-done stories whose dependencies are all done", () => {
    const g = buildGraph([
      feature("900-a", [
        story("900-a", "US1", { status: "done" }),
        story("900-a", "US2", { dependsOn: ["US1"] }),
        story("900-a", "US3", { dependsOn: ["US2"] }),
        story("900-a", "US4"),
      ]),
    ]);
    // US2 waits on a done story, so it is buildable; US3 waits on US2; US4 has no dependencies.
    expect(ids(buildable(g))).toEqual(["900:US-2", "900:US-4"]);
  });

  it("a done story unblocks its dependents, and a done story is never buildable", () => {
    const open = [story("901-a", "US1"), story("901-a", "US2", { blockedBy: ["US1"] })];
    expect(ids(buildable(buildGraph([feature("901-a", open)])))).toEqual(["901:US-1"]);
    const doneFirst = [story("901-a", "US1", { status: "done" }), story("901-a", "US2", { blockedBy: ["US1"] })];
    expect(ids(buildable(buildGraph([feature("901-a", doneFirst)])))).toEqual(["901:US-2"]);
  });

  it("a dependency that does not exist keeps a story out of the buildable set", () => {
    const g = buildGraph([feature("902-a", [story("902-a", "US1", { dependsOn: ["US9"] }), story("902-a", "US2")])]);
    expect(ids(buildable(g))).toEqual(["902:US-2"]);
  });

  it("leaves stories on a cycle out", () => {
    const g = buildGraph([
      feature("903-a", [story("903-a", "US1", { dependsOn: ["US2"] }), story("903-a", "US2", { dependsOn: ["US1"] })]),
    ]);
    expect(buildable(g)).toEqual([]);
  });
});

describe("blockersOf (FR-012)", () => {
  const g = buildGraph([
    feature("904-base", [story("904-base", "US1", { status: "done" }), story("904-base", "US2")]),
    feature("905-top", [
      story("905-top", "US1", { dependsOn: ["904US1", "904US2"], blockedBy: ["904US2", "US9"] }),
    ]),
  ]);
  it("lists each unmet target once, then references that do not resolve", () => {
    expect(blockersOf(g, "905-top:US1")).toEqual([
      { key: "904-base:US2", broken: false },
      { key: "US9", broken: true },
    ]);
  });
  it("is empty for a story with nothing in the way", () => {
    expect(blockersOf(g, "904-base:US2")).toEqual([]);
  });
});

describe("criticalPath (FR-013)", () => {
  it("is the longest chain of not-done stories, prerequisite first", () => {
    const g = buildGraph([
      feature("910-a", [
        story("910-a", "US1"),
        story("910-a", "US2", { dependsOn: ["US1"] }),
        story("910-a", "US3", { dependsOn: ["US2"] }),
        story("910-a", "US4"),
      ]),
    ]);
    expect(ids(criticalPath(g))).toEqual(["910:US-1", "910:US-2", "910:US-3"]);
  });

  it("takes a done story out of the chain", () => {
    const g = buildGraph([
      feature("911-a", [
        story("911-a", "US1", { status: "done" }),
        story("911-a", "US2", { dependsOn: ["US1"] }),
        story("911-a", "US3", { dependsOn: ["US2"] }),
      ]),
    ]);
    expect(ids(criticalPath(g))).toEqual(["911:US-2", "911:US-3"]);
  });

  it("follows cross-feature edges and counts blocked-by like depends-on", () => {
    const g = buildGraph([
      feature("912-base", [story("912-base", "US1")]),
      feature("913-top", [story("913-top", "US1", { blockedBy: ["912US1"] }), story("913-top", "US2", { dependsOn: ["US1"] })]),
    ]);
    expect(ids(criticalPath(g))).toEqual(["912:US-1", "913:US-1", "913:US-2"]);
  });

  it("breaks ties on the earliest story, and gives the same answer on every run", () => {
    const features = [
      feature("914-a", [story("914-a", "US1"), story("914-a", "US2", { dependsOn: ["US1"] })]),
      feature("915-b", [story("915-b", "US1"), story("915-b", "US2", { dependsOn: ["US1"] })]),
    ];
    const first = ids(criticalPath(buildGraph(features)));
    expect(first).toEqual(["914:US-1", "914:US-2"]);
    expect(ids(criticalPath(buildGraph([...features].reverse())))).toEqual(first);
    expect(ids(criticalPath(buildGraph(features)))).toEqual(first);
  });

  it("prefers the earlier prerequisite when two chains into one story are equally long", () => {
    const g = buildGraph([
      feature("916-a", [
        story("916-a", "US1"),
        story("916-a", "US2"),
        story("916-a", "US3", { dependsOn: ["US2", "US1"] }),
      ]),
    ]);
    expect(ids(criticalPath(g))).toEqual(["916:US-1", "916:US-3"]);
  });

  it("leaves stories on a cycle out, and ignores edges into them", () => {
    const g = buildGraph([
      feature("917-a", [
        story("917-a", "US1", { dependsOn: ["US2"] }),
        story("917-a", "US2", { dependsOn: ["US1"] }),
        story("917-a", "US3", { dependsOn: ["US1"] }),
      ]),
    ]);
    expect(ids(criticalPath(g))).toEqual(["917:US-3"]);
  });

  it("is empty when everything is done or there are no stories", () => {
    expect(criticalPath(buildGraph([]))).toEqual([]);
    const g = buildGraph([feature("918-a", [story("918-a", "US1", { status: "done" })])]);
    expect(criticalPath(g)).toEqual([]);
  });
});

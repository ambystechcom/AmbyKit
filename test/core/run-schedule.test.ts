import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/core/graph.js";
import { heldByDependencies, nextToStart } from "../../src/core/run-schedule.js";

const q = (lane: string, assistant: string) => ({ lane, assistant });
const caps = { total: 3, perType: 2 };

describe("run scheduler (feature 028)", () => {
  it("028:FR-005: starts lanes up to the total cap, in queue order", () => {
    const queue = [q("a", "claude"), q("b", "codex"), q("c", "claude"), q("d", "codex")];
    expect(nextToStart(queue, [], caps).map((l) => l.lane)).toEqual(["a", "b", "c"]);
  });

  it("028:FR-005: running lanes use slots; extra lanes wait", () => {
    const queue = [q("c", "claude"), q("d", "codex")];
    expect(nextToStart(queue, [q("a", "claude"), q("b", "codex")], caps).map((l) => l.lane)).toEqual(["c"]);
    expect(nextToStart(queue, [q("a", "claude"), q("b", "codex"), q("x", "codex")], caps)).toEqual([]);
  });

  it("028:FR-005: at most perType lanes of one assistant, without blocking other types", () => {
    const queue = [q("a", "claude"), q("b", "claude"), q("c", "claude"), q("d", "codex")];
    expect(nextToStart(queue, [], caps).map((l) => l.lane)).toEqual(["a", "b", "d"]);
  });

  it("028:FR-005: caps are configurable", () => {
    const queue = [q("a", "x"), q("b", "x"), q("c", "x"), q("d", "x")];
    expect(nextToStart(queue, [], { total: 4, perType: 4 })).toHaveLength(4);
    expect(nextToStart(queue, [], { total: 1, perType: 1 })).toHaveLength(1);
  });

  it("028:FR-005: held lanes are skipped and later lanes still start", () => {
    const queue = [q("a", "x"), q("b", "x")];
    expect(nextToStart(queue, [], caps, new Set(["a"])).map((l) => l.lane)).toEqual(["b"]);
  });

  it("028:FR-005: the same inputs give the same order", () => {
    const queue = [q("a", "x"), q("b", "y"), q("c", "x")];
    expect(nextToStart(queue, [], caps)).toEqual(nextToStart(queue, [], caps));
  });

  it("028:FR-005: a lane is held while a story it builds has an open blocker in another feature", () => {
    const feature = (dir: string, num: string, stories: { id: string; status: string; dep?: string }[]) => ({
      dir,
      ref: num,
      displayRef: num,
      title: dir,
      stories: stories.map((s) => ({ id: s.id, title: s.id, priority: "P1", status: s.status, dependsOn: s.dep ? [s.dep] : [], blockedBy: [] })),
    });
    const graph = buildGraph([
      feature("019-a", "019", [{ id: "US-1", status: "in-progress" }]),
      feature("028-b", "028", [{ id: "US-1", status: "ready", dep: "019:US-1" }]),
    ] as never);
    const held = heldByDependencies(graph, "028-b", [{ lane: "lane-1-1", stories: ["US-1"] }]);
    expect(held.has("lane-1-1")).toBe(true);
    expect(heldByDependencies(graph, "019-a", [{ lane: "lane-1-1", stories: ["US-1"] }]).size).toBe(0);
  });
});

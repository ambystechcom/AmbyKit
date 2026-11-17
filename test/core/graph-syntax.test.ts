import { describe, expect, it } from "vitest";
import { parseStories } from "../../src/core/dashboard.js";
import { buildGraph } from "../../src/core/graph.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";

/** FR-003 / US-2 (feature 023): today's dependency syntax, read through the real story parser. */
function featureFromSpec(dir: string, body: string): FeatureSnapshot {
  const ref = dir.replace(/-.*$/, "");
  return {
    dir,
    ref,
    displayRef: ref,
    stories: parseStories(body, dir),
    tasks: null,
    artifacts: { spec: true, ui: false, uiSignedOff: false, plan: false, tasks: false },
    clarifications: [],
  };
}

const story = (n: number, fields: string): string =>
  `### US-${n} — Story ${n}  (priority: P1)\n\nAs a user, I want ${n}.\n\n${fields}\n- **status:** draft\n\n`;

describe("dependency syntax as written in existing specs (FR-003)", () => {
  const base = featureFromSpec("014-base", story(1, "- **depends-on:** []\n- **blocked-by:** []") + story(2, "- **depends-on:** []"));
  const top = featureFromSpec(
    "015-top",
    story(1, "- **depends-on:** [US-2]\n- **blocked-by:** []") +
      story(2, "- **depends-on:** [014:US-1]") +
      story(3, "- **depends-on:** [014/US-2]") +
      story(4, "- **depends-on:** []\n- **blocked-by:** [US-1, 014:US-1]") +
      story(5, "- **depends-on:** []\n- **blocked-by:** []") +
      story(6, "- **depends-on:** [US-1, US-2]"),
  );
  const graph = buildGraph([base, top]);
  const edge = (from: string, to: string, kind: string) =>
    graph.edges.some((e) => e.from === from && e.to === to && e.kind === kind);

  it("reads a same-feature `depends-on: [US-1]`", () => {
    expect(edge("015-top:US1", "015-top:US2", "depends-on")).toBe(true);
  });

  it("reads a cross-feature `NNN:US-#` reference", () => {
    expect(edge("015-top:US2", "014-base:US1", "depends-on")).toBe(true);
  });

  it("reads the `NNN/US-#` form the same way", () => {
    expect(edge("015-top:US3", "014-base:US2", "depends-on")).toBe(true);
  });

  it("keeps `blocked-by` as a distinct kind, bare and cross-feature", () => {
    expect(edge("015-top:US4", "015-top:US1", "blocked-by")).toBe(true);
    expect(edge("015-top:US4", "014-base:US1", "blocked-by")).toBe(true);
    expect(edge("015-top:US4", "015-top:US1", "depends-on")).toBe(false);
  });

  it("keeps a node with no edges, and reports nothing broken", () => {
    expect(graph.nodes.map((n) => n.id)).toContain("015:US-5");
    expect(graph.edges.some((e) => e.from === "015-top:US5" || e.to === "015-top:US5")).toBe(false);
    expect(graph.broken).toEqual([]);
    expect(graph.cycles).toEqual([]);
  });

  it("yields a feature edge only for the cross-feature references", () => {
    expect(graph.featureEdges).toHaveLength(1);
    expect(graph.featureEdges[0]).toMatchObject({ from: "015-top", to: "014-base" });
    expect(graph.featureEdges[0]!.via).toHaveLength(3);
  });
});

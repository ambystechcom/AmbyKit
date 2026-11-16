import { describe, expect, it } from "vitest";
import type { StoryProgress } from "../../src/core/dashboard.js";
import { buildGraph, parseDependencyRef } from "../../src/core/graph.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";
import { feature, story } from "../helpers/graph-fixtures.js";

const sample = (): FeatureSnapshot[] => [
  feature("905-top", [
    story("905-top", "US1", { dependsOn: ["904US1"] }),
    story("905-top", "US2", { blockedBy: ["US1"] }),
  ]),
  feature("904-base", [story("904-base", "US1"), story("904-base", "US2")]),
];

describe("parseDependencyRef", () => {
  it("reads bare and cross-feature references as stored", () => {
    expect(parseDependencyRef("US1")).toEqual({ ref: null, local: "US1" });
    expect(parseDependencyRef("014US2")).toEqual({ ref: "014", local: "US2" });
    expect(parseDependencyRef("014:US-2")).toEqual({ ref: "014", local: "US2" });
  });
});

describe("buildGraph (FR-001, FR-002)", () => {
  it("returns story nodes, edges with kind, and a derived feature edge", () => {
    const g = buildGraph(sample());
    expect(g.nodes.map((n) => n.id)).toEqual(["904:US-1", "904:US-2", "905:US-1", "905:US-2"]);
    expect(g.edges).toEqual([
      { from: "905-top:US1", to: "904-base:US1", kind: "depends-on" },
      { from: "905-top:US2", to: "905-top:US1", kind: "blocked-by" },
    ]);
    expect(g.featureEdges).toEqual([
      { from: "905-top", to: "904-base", via: [{ from: "905-top:US1", to: "904-base:US1", kind: "depends-on" }] },
    ]);
    expect(g.broken).toEqual([]);
    expect(g.cycles).toEqual([]);
  });

  it("derives a feature edge from blocked-by as well, and lists every causing story edge", () => {
    const g = buildGraph([
      feature("910-a", [story("910-a", "US1", { blockedBy: ["911US1"] }), story("910-a", "US2", { dependsOn: ["911US2"] })]),
      feature("911-b", [story("911-b", "US1"), story("911-b", "US2")]),
    ]);
    expect(g.featureEdges).toHaveLength(1);
    expect(g.featureEdges[0]!.via.map((e) => e.kind)).toEqual(["blocked-by", "depends-on"]);
  });

  it("does not derive a feature edge for stories inside one feature", () => {
    const g = buildGraph([feature("920-a", [story("920-a", "US1"), story("920-a", "US2", { dependsOn: ["US1"] })])]);
    expect(g.featureEdges).toEqual([]);
  });

  it("is a pure function of its input: nothing is mutated", () => {
    const input = sample();
    const copy = structuredClone(input);
    buildGraph(input);
    expect(input).toEqual(copy);
  });
});

describe("determinism (FR-006)", () => {
  it("gives the same graph whatever order the features arrive in", () => {
    const a = buildGraph(sample());
    const b = buildGraph([...sample()].reverse());
    expect(b).toEqual(a);
    const many = [
      feature("930-c", [story("930-c", "US1", { dependsOn: ["931US1", "932US1"] })]),
      feature("931-d", [story("931-d", "US1", { dependsOn: ["932US1"] })]),
      feature("932-e", [story("932-e", "US1")]),
    ];
    const base = buildGraph(many);
    for (const order of [[0, 2, 1], [1, 0, 2], [2, 1, 0]]) {
      expect(buildGraph(order.map((i) => many[i]!))).toEqual(base);
    }
  });
});

describe("broken edges (FR-004)", () => {
  it("names both ends for an unknown story, an unknown feature and a feature with no stories", () => {
    const g = buildGraph([
      feature("940-a", [
        story("940-a", "US1", { blockedBy: ["US9"] }),
        story("940-a", "US2", { dependsOn: ["999US1"] }),
        story("940-a", "US3", { dependsOn: ["941US1"] }),
      ]),
      feature("941-empty", []),
    ]);
    expect(g.broken).toEqual([
      { from: "940-a:US1", to: "US9", kind: "blocked-by", reason: "unknown-story" },
      { from: "940-a:US2", to: "999US1", kind: "depends-on", reason: "unknown-feature" },
      { from: "940-a:US3", to: "941US1", kind: "depends-on", reason: "unknown-story" },
    ]);
    expect(g.edges).toEqual([]);
  });
});

describe("cycles (FR-005)", () => {
  it("reports the IDs on a cycle in order", () => {
    const g = buildGraph([
      feature("950-c", [
        story("950-c", "US1", { dependsOn: ["US2"] }),
        story("950-c", "US2", { dependsOn: ["US3"] }),
        story("950-c", "US3", { dependsOn: ["US1"] }),
        story("950-c", "US4", { dependsOn: ["US1"] }),
      ]),
    ]);
    expect(g.cycles).toEqual([{ stories: ["950-c:US1", "950-c:US2", "950-c:US3"] }]);
  });

  it("reports a self-dependency as a cycle of one", () => {
    const g = buildGraph([feature("951-s", [story("951-s", "US1", { dependsOn: ["US1"] })])]);
    expect(g.cycles).toEqual([{ stories: ["951-s:US1"] }]);
  });

  it("treats mutual feature edges with no story cycle as valid", () => {
    const g = buildGraph([
      feature("952-a", [story("952-a", "US1"), story("952-a", "US2", { dependsOn: ["953US1"] })]),
      feature("953-b", [story("953-b", "US1", { dependsOn: ["952US1"] }), story("953-b", "US2")]),
    ]);
    expect(g.cycles).toEqual([]);
    expect(g.broken).toEqual([]);
    expect(g.featureEdges.map((e) => `${e.from}>${e.to}`)).toEqual(["952-a>953-b", "953-b>952-a"]);
  });
});

describe("edge cases from the spec", () => {
  it("keeps one edge per kind when a dependency is written in both fields, and dedupes repeats", () => {
    const g = buildGraph([
      feature("960-a", [
        story("960-a", "US1"),
        story("960-a", "US2", { dependsOn: ["US1", "US1"], blockedBy: ["US1"] }),
      ]),
    ]);
    expect(g.edges).toEqual([
      { from: "960-a:US2", to: "960-a:US1", kind: "depends-on" },
      { from: "960-a:US2", to: "960-a:US1", kind: "blocked-by" },
    ]);
  });

  it("keeps a done story with an open blocker as an ordinary edge", () => {
    const g = buildGraph([
      feature("961-a", [story("961-a", "US1", { status: "done", blockedBy: ["US2"] }), story("961-a", "US2")]),
    ]);
    expect(g.edges).toEqual([{ from: "961-a:US1", to: "961-a:US2", kind: "blocked-by" }]);
  });

  it("separates two features that share a number (the display ref falls back to the directory)", () => {
    const g = buildGraph([
      feature("008-brownfield", [story("008-brownfield", "US1")], "008-brownfield"),
      feature("008-codex", [story("008-codex", "US1", { dependsOn: ["US1"] })], "008-codex"),
    ]);
    expect(g.nodes.map((n) => n.id)).toEqual(["008-brownfield:US-1", "008-codex:US-1"]);
    expect(g.cycles).toEqual([{ stories: ["008-codex:US1"] }]);
  });

  it("returns an empty graph for no features or a feature without stories", () => {
    expect(buildGraph([])).toEqual({ nodes: [], edges: [], featureEdges: [], broken: [], cycles: [] });
    expect(buildGraph([feature("970-x", [])]).nodes).toEqual([]);
  });
});

describe("scale (SC-001)", () => {
  it("builds a 200-feature graph well inside the one-shot budget", () => {
    const features: FeatureSnapshot[] = [];
    for (let i = 1; i <= 200; i++) {
      const dir = `${String(i).padStart(3, "0")}-f${i}`;
      const stories: StoryProgress[] = [];
      for (let s = 1; s <= 6; s++) {
        const dependsOn = s > 1 ? [`US${s - 1}`] : i > 1 ? [`${String(i - 1).padStart(3, "0")}US1`] : [];
        stories.push(story(dir, `US${s}`, { dependsOn }));
      }
      features.push(feature(dir, stories));
    }
    const t0 = performance.now();
    const g = buildGraph(features);
    const ms = performance.now() - t0;
    expect(g.nodes).toHaveLength(1200);
    expect(g.featureEdges).toHaveLength(199);
    expect(ms).toBeLessThan(500);
  });
});

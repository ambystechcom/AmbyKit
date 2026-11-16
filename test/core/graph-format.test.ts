import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/core/graph.js";
import { GRAPH_JSON_VERSION, prettyRef, toJson, toMermaid, toText } from "../../src/core/graph-format.js";
import { scopeToFeature } from "../../src/core/graph-scope.js";
import { feature, story } from "../helpers/graph-fixtures.js";

const features = () => [
  feature("904-base", [story("904-base", "US1", { title: 'Base "one"' }), story("904-base", "US2")]),
  feature("905-top", [
    story("905-top", "US1", { dependsOn: ["904US1"], title: "Top one" }),
    story("905-top", "US2", { blockedBy: ["US1", "904US2"] }),
  ]),
  feature("906-leaf", [story("906-leaf", "US1", { dependsOn: ["905US1"] })]),
  feature("907-far", [story("907-far", "US1")]),
];
const problem = () =>
  buildGraph([
    feature("908-bad", [
      story("908-bad", "US1", { dependsOn: ["US2"] }),
      story("908-bad", "US2", { dependsOn: ["US1"] }),
      story("908-bad", "US3", { blockedBy: ["US9"] }),
    ]),
  ]);

describe("toText (FR-007)", () => {
  const text = toText(buildGraph(features()));
  it("is readable and names the dependencies of each story", () => {
    expect(text).toContain("Dependency graph: 6 stories, 4 dependencies, 4 features.");
    expect(text).toContain("905:US-1 — Top one [draft]");
    expect(text).toContain("depends-on 904:US-1");
    expect(text).toContain("blocked-by 904:US-2");
  });
  it("lists feature dependencies with their causing story edges", () => {
    expect(text).toContain("905-top -> 904-base  (905:US-1 depends-on 904:US-1; 905:US-2 blocked-by 904:US-2)");
    expect(text).toContain("906-leaf -> 905-top");
  });
  it("lists broken edges and cycles first, before everything else (FR-010)", () => {
    const t = toText(problem());
    expect(t).toContain("[broken] 908:US-3 blocked-by US-9 — unknown story");
    expect(t).toContain("[cycle] 908:US-1 -> 908:US-2 -> 908:US-1");
    expect(t.indexOf("Problems:")).toBeLessThan(t.indexOf("Stories with dependencies:"));
  });
  it("uses plain text only: ASCII arrows and no glyph needed", () => {
    expect(/^[\x00-\x7f—\n]*$/.test(text)).toBe(true);
  });
});

describe("toJson (FR-008)", () => {
  const json = toJson(buildGraph(features()));
  it("has the documented, versioned shape", () => {
    expect(json.version).toBe(GRAPH_JSON_VERSION);
    expect(Object.keys(json)).toEqual(["version", "nodes", "edges", "featureEdges", "broken", "cycles"]);
    expect(Object.keys(json.nodes[0]!)).toEqual(["id", "feature", "story", "title", "status", "priority"]);
    expect(Object.keys(json.edges[0]!)).toEqual(["from", "to", "kind"]);
    expect(Object.keys(json.featureEdges[0]!)).toEqual(["from", "to", "via"]);
  });
  it("uses display ids on edges and is stable run to run", () => {
    expect(json.edges[0]).toEqual({ from: "905:US-1", to: "904:US-1", kind: "depends-on" });
    expect(JSON.stringify(toJson(buildGraph(features())))).toBe(JSON.stringify(json));
  });
  it("carries broken edges and cycles by id", () => {
    const j = toJson(problem());
    expect(j.broken).toEqual([{ from: "908:US-3", to: "US-9", kind: "blocked-by", reason: "unknown-story" }]);
    expect(j.cycles).toEqual([["908:US-1", "908:US-2"]]);
  });
});

describe("toMermaid (FR-007)", () => {
  const graph = buildGraph(features());
  const m = toMermaid(graph);
  const lines = m.split("\n");
  const links = lines.filter((l) => / (-->|-\.->) /.test(l) && !l.includes("%%"));
  it("starts a flowchart with one subgraph per feature", () => {
    expect(lines[0]).toBe("graph TD");
    expect(lines.filter((l) => l.trim().startsWith("subgraph ")).length).toBe(4);
    expect(lines.filter((l) => l.trim() === "end").length).toBe(4);
  });
  it("draws depends-on solid, blocked-by dashed, and feature edges between subgraphs", () => {
    expect(links.filter((l) => l.includes(" --> ")).length).toBe(graph.edges.filter((e) => e.kind === "depends-on").length);
    expect(links.filter((l) => l.includes(" -.-> ")).length).toBe(graph.edges.filter((e) => e.kind === "blocked-by").length);
    expect(lines.filter((l) => / ==> /.test(l)).length).toBe(graph.featureEdges.length);
  });
  it("declares every node it links, with safe identifiers and escaped quotes", () => {
    for (const l of links) {
      for (const id of l.trim().split(/ (?:-->|-\.->) /)) expect(m).toContain(`${id}["`);
    }
    expect(m).toContain("Base #quot;one#quot;");
    expect(/^\s+[A-Za-z0-9_]+\[/.test(lines.find((l) => l.includes('US1["'))!)).toBe(true);
  });
});

describe("scopeToFeature (FR-009)", () => {
  const graph = buildGraph(features());
  it("keeps the feature and its direct neighbours in both directions", () => {
    const s = scopeToFeature(graph, "905")!;
    expect([...new Set(s.nodes.map((n) => n.feature))]).toEqual(["904-base", "905-top", "906-leaf"]);
    expect(s.featureEdges.map((e) => `${e.from}>${e.to}`)).toEqual(["905-top>904-base", "906-leaf>905-top"]);
  });
  it("does not reach second-degree neighbours", () => {
    const s = scopeToFeature(graph, "904-base")!;
    expect([...new Set(s.nodes.map((n) => n.feature))]).toEqual(["904-base", "905-top"]);
  });
  it("returns null for an unknown feature and leaves the input alone", () => {
    const copy = structuredClone(graph);
    expect(scopeToFeature(graph, "999")).toBeNull();
    scopeToFeature(graph, "905");
    expect(graph).toEqual(copy);
  });
  it("keeps the broken edges and cycles inside the scope", () => {
    const s = scopeToFeature(problem(), "908")!;
    expect(s.broken).toHaveLength(1);
    expect(s.cycles).toHaveLength(1);
  });
});

describe("prettyRef", () => {
  it("restores the written form", () => {
    expect(prettyRef("US9")).toBe("US-9");
    expect(prettyRef("014US2")).toBe("014:US-2");
    expect(prettyRef("something")).toBe("something");
  });
});

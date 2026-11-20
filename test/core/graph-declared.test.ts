import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/core/graph.js";
import { toJson, toMermaid, toText } from "../../src/core/graph-format.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";
import { feature, story } from "../helpers/graph-fixtures.js";

const withDeps = (f: FeatureSnapshot, dependsOn: string[]): FeatureSnapshot => ({ ...f, dependsOn });

const base = feature("019-base", [story("019-base", "US1")]);
const top = feature("031-top", [story("031-top", "US1")]);

describe("declared feature dependencies (030, US-9)", () => {
  it("030:FR-016: a declared feature depends-on adds a feature edge marked declared, with no story edges behind it", () => {
    const g = buildGraph([base, withDeps(top, ["019"])]);
    expect(g.featureEdges).toEqual([{ from: "031-top", to: "019-base", via: [], declared: true }]);
    expect(g.broken).toEqual([]);
  });

  it("030:FR-016: a directory name works as well as a number, and a number ignores leading zeros", () => {
    expect(buildGraph([base, withDeps(top, ["019-base"])]).featureEdges[0]).toMatchObject({ to: "019-base", declared: true });
    expect(buildGraph([base, withDeps(top, ["19"])]).featureEdges[0]).toMatchObject({ to: "019-base", declared: true });
  });

  it("030:FR-016: a declared dependency that also has story edges merges into one edge, keeping its via", () => {
    const linked = feature("031-top", [story("031-top", "US1", { dependsOn: ["019US1"] })]);
    const g = buildGraph([base, withDeps(linked, ["019"])]);
    expect(g.featureEdges).toHaveLength(1);
    expect(g.featureEdges[0]).toMatchObject({ from: "031-top", to: "019-base", declared: true });
    expect(g.featureEdges[0]?.via).toHaveLength(1);
  });

  it("030:FR-016: a derived-only edge is not marked declared", () => {
    const linked = feature("031-top", [story("031-top", "US1", { dependsOn: ["019US1"] })]);
    const g = buildGraph([base, linked]);
    expect(g.featureEdges[0]).not.toHaveProperty("declared");
  });

  it("030:FR-016: an unknown feature is a broken edge with reason unknown-feature at feature scope", () => {
    const g = buildGraph([base, withDeps(top, ["099", "not-a-feature"])]);
    expect(g.broken).toEqual([
      { from: "031-top", to: "099", kind: "depends-on", reason: "unknown-feature", scope: "feature" },
      { from: "031-top", to: "not-a-feature", kind: "depends-on", reason: "unknown-feature", scope: "feature" },
    ]);
    expect(g.featureEdges).toEqual([]);
  });

  it("030:FR-016: a feature depending on itself adds nothing", () => {
    const g = buildGraph([withDeps(base, ["019"])]);
    expect(g.featureEdges).toEqual([]);
    expect(g.broken).toEqual([]);
  });

  it("030:FR-016: a 1.x project (no dependsOn anywhere) builds exactly the graph it did before", () => {
    const linked = feature("031-top", [story("031-top", "US1", { dependsOn: ["019US1"] })]);
    const g = buildGraph([base, linked]);
    expect(JSON.stringify(toJson(g))).not.toMatch(/declared|scope/);
  });

  it("030:FR-016: feature edges stay sorted and the build is order-independent", () => {
    const mid = feature("023-mid", [story("023-mid", "US1")]);
    const a = buildGraph([base, mid, withDeps(top, ["023", "019"])]);
    const b = buildGraph([withDeps(top, ["019", "023"]), mid, base]);
    expect(a.featureEdges.map((e) => `${e.from}>${e.to}`)).toEqual(["031-top>019-base", "031-top>023-mid"]);
    expect(b.featureEdges).toEqual(a.featureEdges);
  });

  it("030:FR-016: the formatters show declared edges and feature-scope problems; graph json version stays 1", () => {
    const g = buildGraph([base, withDeps(top, ["019", "099"])]);
    const json = toJson(g);
    expect(json.version).toBe(1);
    expect(json.featureEdges[0]).toMatchObject({ from: "031-top", to: "019-base", declared: true });
    expect(json.broken[0]).toMatchObject({ from: "031-top", to: "099", reason: "unknown-feature", scope: "feature" });
    const text = toText(g);
    expect(text).toMatch(/031-top -> 019-base {2}\(declared\)/);
    expect(text).toMatch(/\[broken\] 031-top depends-on 099 — unknown feature/);
    expect(toMermaid(g)).toMatch(/f_031_top ==> f_019_base/);
  });
});

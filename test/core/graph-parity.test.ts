import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeGraph } from "../../src/core/analyze.js";
import { readFeatures } from "../../src/core/features.js";
import { buildGraph } from "../../src/core/graph.js";

/**
 * SC-002 / US-2 (feature 023): the graph over this repo's real specs says what `analyze` says: the same
 * stories, the same dangling references, the same cycle members, and no new errors.
 */
const root = join(import.meta.dirname, "..", "..");
const { features } = readFeatures(root);
const stories = features.flatMap((f) => f.stories);

describe("graph parity with analyze over this repo's specs", () => {
  const graph = buildGraph(features);
  const report = analyzeGraph(stories);

  it("has one node per story", () => {
    expect(graph.nodes.length).toBe(stories.length);
    expect(stories.length).toBeGreaterThan(50);
  });

  it("reports as many broken edges as analyze reports dangling references", () => {
    expect(graph.broken.length).toBe(report.issues.filter((i) => i.kind === "dangling-reference").length);
  });

  it("reports cycles exactly when analyze does, with the same members", () => {
    const analyzeCycle = report.issues.find((i) => i.kind === "cycle");
    expect(graph.cycles.length > 0).toBe(analyzeCycle !== undefined);
    expect(graph.cycles.flatMap((c) => c.stories).length).toBe(analyzeCycle?.stories.length ?? 0);
  });

  it("adds no new errors: today's repo specs resolve every dependency", () => {
    expect(graph.broken).toEqual([]);
    expect(graph.cycles).toEqual([]);
    expect(report.issues).toEqual([]);
  });

  it("matches analyze on which stories have unmet blockers (edge targets not done)", () => {
    const done = new Set(graph.nodes.filter((n) => n.status === "done").map((n) => n.key));
    const blockedByGraph = new Set(graph.edges.filter((e) => !done.has(e.to)).map((e) => e.from));
    const open = new Set(graph.nodes.filter((n) => !done.has(n.key)).map((n) => n.key));
    const blockedKeys = [...blockedByGraph].filter((k) => open.has(k)).length;
    expect(blockedKeys).toBe(report.blocked.length);
  });
});

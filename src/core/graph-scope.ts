import type { DependencyGraph } from "./graph-types.js";

/**
 * FR-009: narrow a graph to one feature and its direct neighbours, in both directions (features it
 * depends on and features that depend on it). `ref` matches the feature directory, its number or its
 * display ref. Returns null when no feature matches. Pure; the input is not changed.
 */
export function scopeToFeature(graph: DependencyGraph, ref: string): DependencyGraph | null {
  const features = new Map<string, { dir: string; ref: string }>();
  for (const n of graph.nodes) features.set(n.feature, { dir: n.feature, ref: n.ref });
  const numberOf = (dir: string): string => /^(\d+)/.exec(dir)?.[1] ?? dir;
  const focus = [...features.values()].filter((f) => f.dir === ref || f.ref === ref || numberOf(f.dir) === ref);
  if (focus.length === 0) return null;

  const keep = new Set(focus.map((f) => f.dir));
  for (const e of graph.featureEdges) {
    if (keep.has(e.from)) keep.add(e.to);
    if (focus.some((f) => f.dir === e.to)) keep.add(e.from);
  }

  const nodes = graph.nodes.filter((n) => keep.has(n.feature));
  const kept = new Set(nodes.map((n) => n.key));
  return {
    nodes,
    edges: graph.edges.filter((e) => kept.has(e.from) && kept.has(e.to)),
    featureEdges: graph.featureEdges.filter((e) => keep.has(e.from) && keep.has(e.to)),
    broken: graph.broken.filter((b) => kept.has(b.from)),
    cycles: graph.cycles.filter((c) => c.stories.every((s) => kept.has(s))),
  };
}

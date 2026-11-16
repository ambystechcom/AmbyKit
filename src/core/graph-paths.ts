import type { BrokenEdge, DependencyGraph, StoryEdge, StoryNode } from "./graph-types.js";

/**
 * Feature 023: questions asked of a built graph (FR-012, FR-013). Pure functions of a `DependencyGraph`;
 * no filesystem. Loaded by `analyze` and, lazily, by the interactive graph view, never by the one-shot
 * dashboard (FR-015).
 */

/** One unmet blocker of a story: a story that is not done yet, or a dependency that does not resolve. */
export interface Blocker {
  /** The blocking node's key, or the reference as written when `broken`. */
  key: string;
  broken: boolean;
}

interface Index {
  byKey: Map<string, StoryNode>;
  edgesFrom: Map<string, StoryEdge[]>;
  brokenFrom: Map<string, BrokenEdge[]>;
}

const indexes = new WeakMap<DependencyGraph, Index>();

/** Lookup tables for a graph, built once per graph object. */
function indexOf(graph: DependencyGraph): Index {
  const cached = indexes.get(graph);
  if (cached) return cached;
  const edgesFrom = new Map<string, StoryEdge[]>();
  for (const e of graph.edges) edgesFrom.set(e.from, [...(edgesFrom.get(e.from) ?? []), e]);
  const brokenFrom = new Map<string, BrokenEdge[]>();
  for (const b of graph.broken) brokenFrom.set(b.from, [...(brokenFrom.get(b.from) ?? []), b]);
  const index = { byKey: new Map(graph.nodes.map((n) => [n.key, n])), edgesFrom, brokenFrom };
  indexes.set(graph, index);
  return index;
}

const isDone = (n: StoryNode | undefined): boolean => n?.status === "done";

/**
 * The unmet blockers of a story: every `depends-on` / `blocked-by` target that is not done, then every
 * dependency that does not resolve (a missing story can never be done). Each target is listed once,
 * even when written under both kinds. This is the rule `analyze` has always used.
 */
export function blockersOf(graph: DependencyGraph, key: string): Blocker[] {
  const { byKey, edgesFrom, brokenFrom } = indexOf(graph);
  const out: Blocker[] = [];
  const seen = new Set<string>();
  for (const e of edgesFrom.get(key) ?? []) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    if (!isDone(byKey.get(e.to))) out.push({ key: e.to, broken: false });
  }
  for (const b of brokenFrom.get(key) ?? []) {
    if (seen.has(`?${b.to}`)) continue;
    seen.add(`?${b.to}`);
    out.push({ key: b.to, broken: true });
  }
  return out;
}

/** FR-012: the not-done stories with no unmet blocker, in graph order. */
export function buildable(graph: DependencyGraph): StoryNode[] {
  return graph.nodes.filter((n) => !isDone(n) && blockersOf(graph, n.key).length === 0);
}

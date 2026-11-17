import type { BrokenEdge, DependencyGraph, EdgeKind, StoryEdge } from "./graph-types.js";

/**
 * Feature 023: pure formatters for the dependency graph (FR-007, FR-008). Strings only; no filesystem,
 * no terminal capability checks, so the output is identical everywhere (plain text, no glyph needed).
 */

/** Canonical ids back to their written form: `US9` -> `US-9`, `014US2` -> `014:US-2`. */
export function prettyRef(dep: string): string {
  const m = /^(?:(\d+))?US(\d+)$/.exec(dep);
  return m ? `${m[1] ? `${m[1]}:` : ""}US-${m[2]}` : dep;
}

const idOf = (graph: DependencyGraph): ((key: string) => string) => {
  const ids = new Map(graph.nodes.map((n) => [n.key, n.id]));
  return (key) => ids.get(key) ?? key;
};

const reasonText = (b: BrokenEdge): string => (b.reason === "unknown-feature" ? "unknown feature" : "unknown story");

/** Version of the `--json` shape documented in specs/023-dependency-graph/contracts/graph-json.md. */
export const GRAPH_JSON_VERSION = 1;

export interface GraphJson {
  version: number;
  nodes: { id: string; feature: string; story: string; title: string; status: string; priority: string }[];
  edges: { from: string; to: string; kind: EdgeKind }[];
  featureEdges: { from: string; to: string; via: { from: string; to: string; kind: EdgeKind }[] }[];
  broken: { from: string; to: string; kind: EdgeKind; reason: string }[];
  cycles: string[][];
}

/** FR-008: the stable machine shape. Fields are only ever added. */
export function toJson(graph: DependencyGraph): GraphJson {
  const id = idOf(graph);
  const edge = (e: StoryEdge) => ({ from: id(e.from), to: id(e.to), kind: e.kind });
  return {
    version: GRAPH_JSON_VERSION,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      feature: n.feature,
      story: n.story,
      title: n.title,
      status: n.status,
      priority: n.priority,
    })),
    edges: graph.edges.map(edge),
    featureEdges: graph.featureEdges.map((f) => ({ from: f.from, to: f.to, via: f.via.map(edge) })),
    broken: graph.broken.map((b) => ({ from: id(b.from), to: prettyRef(b.to), kind: b.kind, reason: b.reason })),
    cycles: graph.cycles.map((c) => c.stories.map(id)),
  };
}

/** Readable text: problems first (FR-010), then feature dependencies, then each story and what it waits on. */
export function toText(graph: DependencyGraph): string {
  const id = idOf(graph);
  const out: string[] = [];
  const features = new Set(graph.nodes.map((n) => n.feature)).size;
  out.push(`Dependency graph: ${graph.nodes.length} stories, ${graph.edges.length} dependencies, ${features} features.`);

  if (graph.broken.length > 0 || graph.cycles.length > 0) {
    out.push("", "Problems:");
    for (const b of graph.broken) {
      out.push(`  [broken] ${id(b.from)} ${b.kind} ${prettyRef(b.to)} — ${reasonText(b)}`);
    }
    for (const c of graph.cycles) {
      const ring = c.stories.map(id);
      out.push(`  [cycle] ${[...ring, ring[0] ?? ""].join(" -> ")}`);
    }
  }

  if (graph.featureEdges.length > 0) {
    out.push("", "Feature dependencies:");
    for (const f of graph.featureEdges) {
      out.push(`  ${f.from} -> ${f.to}  (${f.via.map((e) => `${id(e.from)} ${e.kind} ${id(e.to)}`).join("; ")})`);
    }
  }

  const edgesFrom = new Map<string, StoryEdge[]>();
  for (const e of graph.edges) edgesFrom.set(e.from, [...(edgesFrom.get(e.from) ?? []), e]);
  const stories = graph.nodes.filter((n) => edgesFrom.has(n.key));
  if (stories.length > 0) {
    out.push("", "Stories with dependencies:");
    for (const n of stories) {
      out.push(`  ${n.id}${n.title ? ` — ${n.title}` : ""}${n.status ? ` [${n.status}]` : ""}`);
      for (const e of edgesFrom.get(n.key) ?? []) out.push(`      ${e.kind} ${id(e.to)}`);
    }
  }
  return out.join("\n");
}

const safeId = (prefix: string, value: string): string => `${prefix}_${value.replace(/[^A-Za-z0-9]/g, "_")}`;
const safeLabel = (value: string): string => value.replace(/"/g, "#quot;").replace(/[\r\n]+/g, " ");

/**
 * Mermaid flowchart: one subgraph per feature, a solid arrow for `depends-on`, a dashed arrow for
 * `blocked-by`, and a thick arrow between subgraphs for each derived feature edge. `A --> B` reads
 * "A depends on B". Syntax is checked structurally in tests; a renderer check is a manual step.
 */
export function toMermaid(graph: DependencyGraph): string {
  const out: string[] = ["graph TD", "  %% A --> B: A depends on B; A -.-> B: A is blocked by B"];
  const nodeId = (key: string): string => safeId("s", key);
  const byFeature = new Map<string, typeof graph.nodes>();
  for (const n of graph.nodes) byFeature.set(n.feature, [...(byFeature.get(n.feature) ?? []), n]);
  for (const [feature, nodes] of byFeature) {
    out.push(`  subgraph ${safeId("f", feature)}["${safeLabel(feature)}"]`);
    for (const n of nodes) out.push(`    ${nodeId(n.key)}["${safeLabel(`${n.id} ${n.title}`.trim())}"]`);
    out.push("  end");
  }
  for (const e of graph.edges) {
    out.push(`  ${nodeId(e.from)} ${e.kind === "blocked-by" ? "-.->" : "-->"} ${nodeId(e.to)}`);
  }
  for (const f of graph.featureEdges) out.push(`  ${safeId("f", f.from)} ==> ${safeId("f", f.to)}`);
  return out.join("\n");
}

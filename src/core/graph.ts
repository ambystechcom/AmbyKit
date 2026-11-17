import { canonicalStoryId } from "./dashboard.js";
import { compareFeatureDirs } from "./features.js";
import type {
  BrokenEdge,
  DependencyGraph,
  EdgeKind,
  FeatureEdge,
  GraphCycle,
  StoryEdge,
  StoryNode,
} from "./graph-types.js";
import type { FeatureSnapshot } from "./overview-types.js";

/**
 * Feature 023: the one place that turns the stories of every feature into a dependency graph (FR-001).
 * Pure: a function of `FeatureSnapshot[]`, no filesystem, no mutation of its input, same output for the
 * same specs whatever order the features arrive in (FR-006). `analyze`, the dashboard, `ambykit graph`
 * and later the run scheduler and the MCP server all read dependencies from here (FR-011).
 */

const QUALIFIED = /^(\d+)[:/]?(US\d+)$/;

/**
 * Parse a dependency as stored on a story (`US1`, or `014US2` for a cross-feature `014:US-2`).
 * `ref` is the target feature's number, or null when the dependency stays inside the story's feature.
 * The single definition of the cross-feature syntax; nothing else resolves dependencies.
 */
export function parseDependencyRef(dep: string): { ref: string | null; local: string } {
  const canonical = canonicalStoryId(dep);
  const m = QUALIFIED.exec(canonical);
  return m ? { ref: m[1] ?? null, local: m[2] ?? canonical } : { ref: null, local: canonical };
}

/** Collision-safe node key: story ids restart per feature, and two features can share a number. */
export function nodeKey(featureDir: string, canonicalId: string): string {
  return `${featureDir}:${canonicalId}`;
}

export function buildGraph(features: FeatureSnapshot[]): DependencyGraph {
  const sorted = [...features].sort((a, b) => compareFeatureDirs(a.dir, b.dir));

  const nodes: StoryNode[] = [];
  const byKey = new Map<string, StoryNode>();
  for (const f of sorted) {
    for (const s of f.stories) {
      const key = nodeKey(f.dir, s.id);
      if (byKey.has(key)) continue; // a story id written twice in one spec: the first one wins
      const node: StoryNode = {
        key,
        id: `${f.displayRef}:${s.displayId}`,
        feature: f.dir,
        ref: f.displayRef,
        story: s.displayId,
        title: s.title,
        status: s.status,
        priority: s.priority,
      };
      nodes.push(node);
      byKey.set(key, node);
    }
  }

  // A `NNN:US-#` reference targets the first feature carrying that number (same rule the dashboard used).
  const featureByRef = new Map<string, FeatureSnapshot>();
  for (const f of sorted) if (!featureByRef.has(f.ref)) featureByRef.set(f.ref, f);

  const edges: StoryEdge[] = [];
  const broken: BrokenEdge[] = [];
  const done = new Set<string>();
  for (const f of sorted) {
    for (const s of f.stories) {
      const from = nodeKey(f.dir, s.id);
      if (done.has(from)) continue;
      done.add(from);
      const declared: [EdgeKind, string[]][] = [
        ["depends-on", s.dependsOn],
        ["blocked-by", s.blockedBy],
      ];
      for (const [kind, deps] of declared) {
        const seen = new Set<string>();
        for (const dep of deps) {
          if (seen.has(dep)) continue;
          seen.add(dep);
          const { ref, local } = parseDependencyRef(dep);
          const target = ref === null ? f : featureByRef.get(ref);
          if (!target) {
            broken.push({ from, to: dep, kind, reason: "unknown-feature" });
            continue;
          }
          const to = nodeKey(target.dir, local);
          if (byKey.has(to)) edges.push({ from, to, kind });
          else broken.push({ from, to: dep, kind, reason: "unknown-story" });
        }
      }
    }
  }

  return { nodes, edges, featureEdges: featureEdgesOf(edges, byKey), broken, cycles: cyclesOf(nodes, edges) };
}

/** FR-002: feature A depends on feature B when a story of A has an edge to a story of B; both kinds count. */
function featureEdgesOf(edges: StoryEdge[], byKey: Map<string, StoryNode>): FeatureEdge[] {
  const grouped = new Map<string, FeatureEdge>();
  for (const e of edges) {
    const from = byKey.get(e.from)?.feature;
    const to = byKey.get(e.to)?.feature;
    if (!from || !to || from === to) continue;
    const id = `${from}\u0000${to}`;
    const entry = grouped.get(id) ?? { from, to, via: [] };
    entry.via.push({ ...e });
    grouped.set(id, entry);
  }
  return [...grouped.values()].sort((a, b) => compareFeatureDirs(a.from, b.from) || compareFeatureDirs(a.to, b.to));
}

/**
 * FR-005: each dependency cycle as the ordered keys on it (a self-dependency is a cycle of one). One
 * depth-first pass; a back edge to a node still on the stack closes a cycle.
 */
function cyclesOf(nodes: StoryNode[], edges: StoryEdge[]): GraphCycle[] {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    const list = next.get(e.from) ?? [];
    if (!list.includes(e.to)) list.push(e.to);
    next.set(e.from, list);
  }
  const color = new Map<string, number>(); // absent = unseen, 1 = on stack, 2 = finished
  const stack: string[] = [];
  const cycles: GraphCycle[] = [];
  const known = new Set<string>();
  const visit = (key: string): void => {
    color.set(key, 1);
    stack.push(key);
    for (const to of next.get(key) ?? []) {
      const c = color.get(to);
      if (c === 1) {
        const stories = stack.slice(stack.indexOf(to));
        const id = [...stories].sort().join("\u0000");
        if (!known.has(id)) {
          known.add(id);
          cycles.push({ stories });
        }
      } else if (c === undefined) {
        visit(to);
      }
    }
    stack.pop();
    color.set(key, 2);
  };
  for (const n of nodes) if (!color.has(n.key)) visit(n.key);
  return cycles;
}

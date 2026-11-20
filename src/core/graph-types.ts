/**
 * Feature 023: the shared dependency graph (types). Pure data, no behaviour. See `graph.ts` for
 * `buildGraph`, `graph-paths.ts` for buildable/critical-path, `graph-format.ts` for text/JSON/Mermaid.
 */

/** `depends-on` = needs that story done first; `blocked-by` = something external blocks it. A story may use both. */
export type EdgeKind = "depends-on" | "blocked-by";

/** Why a dependency does not resolve (FR-004). */
export type BrokenReason = "unknown-story" | "unknown-feature";

export interface StoryNode {
  /** Collision-safe internal key: `<feature dir>:<canonical story id>`, e.g. `905-top:US1`. */
  key: string;
  /** Display ID qualified by the feature's display ref, e.g. `905:US-1` (the directory name when two features share a number). */
  id: string;
  /** Feature directory, e.g. `905-top`. */
  feature: string;
  /** Feature display ref, e.g. `905`. */
  ref: string;
  /** Story ID as written, e.g. `US-1`. */
  story: string;
  title: string;
  status: string;
  priority: string;
}

/** `from` depends on / is blocked by `to`. Both ends are node keys. */
export interface StoryEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** Derived (FR-002): feature `from` depends on feature `to`; `via` records the story edges that cause it. Ends are feature dirs. */
export interface FeatureEdge {
  from: string;
  to: string;
  via: StoryEdge[];
  /** Feature 030: the feature declares this dependency itself (frontmatter `depends-on`); `via` may then be empty. Absent = derived only. */
  declared?: true;
}

/** A dependency that names something that does not exist (FR-004): `from` is a node key, `to` is the reference as written. */
export interface BrokenEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  reason: BrokenReason;
  /** Feature 030: `"feature"` when a feature-level `depends-on` names an unknown feature; `from` is then a feature directory. Absent = story-level. */
  scope?: "feature";
}

/** A dependency cycle (FR-005): node keys in dependency order; a self-dependency is a cycle of one. */
export interface GraphCycle {
  stories: string[];
}

export interface DependencyGraph {
  /** Sorted by feature directory, then story number. */
  nodes: StoryNode[];
  /** Grouped by `from` node (in node order), each node's edges in declaration order, depends-on before blocked-by. */
  edges: StoryEdge[];
  featureEdges: FeatureEdge[];
  broken: BrokenEdge[];
  cycles: GraphCycle[];
}

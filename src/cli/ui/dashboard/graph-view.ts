import { buildGraph } from "../../../core/graph.js";
import { blockersOf, buildable, criticalPath } from "../../../core/graph-paths.js";
import type { FeatureSnapshot } from "../../../core/overview-types.js";
import type { Capabilities } from "../types.js";
import { truncateVisible } from "./panel.js";

/**
 * Interactive graph view (feature 023, US-6): what blocks what, what is buildable now, the critical path,
 * and a jump from a story to its feature. A deliberately plain text list (FR-016): no frames, color or glyph
 * is needed, so it reads the same on a narrow terminal. Spec 032 restyles it inside the tabbed layout; no
 * `/amby.design` sign-off exists yet, so this shows the facts only.
 *
 * Loaded only by the interactive dashboard, through a dynamic import, so one-shot and `--json` output never
 * load it (FR-015).
 */

export interface GraphRow {
  key: string;
  /** Qualified display id, e.g. `014:US-2`. */
  id: string;
  /** Feature directory, for the jump. */
  feature: string;
  /** Story id as written, e.g. `US-2`. */
  story: string;
  title: string;
  state: "buildable" | "blocked";
  /** Display ids of the unmet blockers (or the reference as written when it does not resolve). */
  blockers: string[];
  /** Display ids of the not-done stories that depend on this one. */
  blocks: string[];
  critical: boolean;
}

export interface GraphViewModel {
  rows: GraphRow[];
  /** Display ids of the critical path, prerequisite first. */
  critical: string[];
  buildableCount: number;
  doneCount: number;
  /** Broken edges plus cycles: a reason to run `ambykit graph`. */
  problems: number;
}

/** The two functions the interactive reducer is given, so it never imports this module itself. */
export interface GraphViewApi {
  build(features: FeatureSnapshot[]): GraphViewModel;
  render(caps: Capabilities, model: GraphViewModel, cursor: number): string;
}

export function buildGraphViewModel(features: FeatureSnapshot[]): GraphViewModel {
  const graph = buildGraph(features);
  const idOf = new Map(graph.nodes.map((n) => [n.key, n.id]));
  const open = graph.nodes.filter((n) => n.status !== "done");
  const openKeys = new Set(open.map((n) => n.key));
  const ready = new Set(buildable(graph).map((n) => n.key));
  const path = criticalPath(graph);
  const onPath = new Set(path.map((n) => n.key));

  const blocks = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!openKeys.has(e.from)) continue;
    const list = blocks.get(e.to) ?? [];
    const id = idOf.get(e.from);
    if (id && !list.includes(id)) list.push(id);
    blocks.set(e.to, list);
  }

  const rows: GraphRow[] = open.map((n) => ({
    key: n.key,
    id: n.id,
    feature: n.feature,
    story: n.story,
    title: n.title,
    state: ready.has(n.key) ? "buildable" : "blocked",
    blockers: blockersOf(graph, n.key).map((b) => (b.broken ? b.key : (idOf.get(b.key) ?? b.key))),
    blocks: blocks.get(n.key) ?? [],
    critical: onPath.has(n.key),
  }));

  return {
    rows,
    critical: path.map((n) => n.id),
    buildableCount: ready.size,
    doneCount: graph.nodes.length - open.length,
    problems: graph.broken.length + graph.cycles.length,
  };
}

/** Rows shown at once; the list scrolls to keep the cursor in view. */
const WINDOW = 12;

export function renderGraphView(caps: Capabilities, model: GraphViewModel, cursor: number): string {
  const fit = (line: string): string => truncateVisible(caps, line, Math.max(20, caps.columns));
  const out: string[] = [];
  out.push(fit(`Dependency graph: ${model.rows.length} open stories, ${model.buildableCount} buildable now, ${model.doneCount} done`));
  if (model.problems > 0) out.push(fit(`${model.problems} broken edge(s) or cycle(s): run \`ambykit graph\` to list them.`));
  out.push("");
  out.push(fit(model.critical.length > 0 ? `Critical path (${model.critical.length}): ${model.critical.join(" -> ")}` : "Critical path: none (nothing open)"));
  out.push("");

  if (model.rows.length === 0) {
    out.push("Nothing open: every story is done.");
    return out.join("\n");
  }

  const at = Math.min(Math.max(0, cursor), model.rows.length - 1);
  const start = Math.max(0, Math.min(at - Math.floor(WINDOW / 2), model.rows.length - WINDOW));
  const shown = model.rows.slice(start, start + WINDOW);
  const idWidth = Math.max(...shown.map((r) => r.id.length));
  if (start > 0) out.push(`  ... ${start} more above`);
  shown.forEach((r, i) => {
    const mark = start + i === at ? ">" : " ";
    const state = r.state === "buildable" ? "buildable" : `blocked by ${r.blockers.join(", ")}`;
    out.push(fit(`${mark} ${r.id.padEnd(idWidth)}  ${state}${r.critical ? "  [critical path]" : ""}`));
  });
  const below = model.rows.length - (start + shown.length);
  if (below > 0) out.push(`  ... ${below} more below`);

  const sel = model.rows[at]!;
  out.push("");
  out.push(fit(`${sel.id} - ${sel.title}`));
  out.push(fit(`  blocked by: ${sel.blockers.length > 0 ? sel.blockers.join(", ") : "nothing"}`));
  out.push(fit(`  blocks:     ${sel.blocks.length > 0 ? sel.blocks.join(", ") : "nothing"}`));
  return out.join("\n");
}

export const graphViewApi: GraphViewApi = { build: buildGraphViewModel, render: renderGraphView };

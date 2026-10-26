import { canonicalStoryId, type StoryProgress, type TaskLine } from "./dashboard.js";
import {
  STATUS_ORDER,
  type AttentionItem,
  type FeatureRow,
  type FeatureSnapshot,
  type Filters,
  type Overview,
  type OverviewOptions,
  type ParseIssue,
  type Phase,
  type Status,
  type Summary,
  type UpNextItem,
} from "./overview-types.js";

/**
 * Compute the dashboard overview from feature snapshots (feature 014). Pure — no filesystem, no
 * model tokens (FR-001). Filters apply once, before any aggregate, so every widget agrees (FR-011).
 * Dependencies resolve against the unfiltered set, so a filtered story still sees its blockers.
 */
export function computeOverview(
  features: FeatureSnapshot[],
  filters: Filters = {},
  opts: OverviewOptions = { upNextCap: 5 },
  issues: ParseIssue[] = [],
): Overview {
  const scoped = applyFilters(features, filters);
  const attention = attentionItems(features, scoped);
  return {
    summary: summarize(scoped),
    statusCounts: statusCounts(scoped),
    features: scoped.map(featureRow),
    attention,
    upNext: upNext(scoped, attention, opts.upNextCap),
    issues,
  };
}

/**
 * Narrow features to the filters (I-9). `feature` matches the ref (`014`) or the directory name.
 * With a status filter, each feature keeps only matching stories and their tasks; features left with
 * no matching story drop out.
 */
export function applyFilters(features: FeatureSnapshot[], filters: Filters): FeatureSnapshot[] {
  let out = features;
  if (filters.feature) {
    const f = filters.feature;
    out = out.filter((x) => x.ref === f || x.dir === f || x.displayRef === f);
  }
  if (filters.status) {
    const status = filters.status.toLowerCase();
    out = out
      .map((x) => {
        const stories = x.stories.filter((s) => s.status === status);
        const ids = new Set(stories.map((s) => s.id));
        const tasks = x.tasks ? x.tasks.filter((t) => t.story !== null && ids.has(t.story)) : null;
        return { ...x, stories, tasks };
      })
      .filter((x) => x.stories.length > 0);
  }
  return out;
}

/** Headline numbers for the summary cards (FR-002, I-1). */
export function summarize(features: FeatureSnapshot[]): Summary {
  const stories = features.flatMap((f) => f.stories);
  const tasks: TaskLine[] = features.flatMap((f) => f.tasks ?? []);
  const tasksDone = tasks.filter((t) => t.done).length;
  return {
    features: features.length,
    featuresDone: features.filter(isFeatureDone).length,
    stories: stories.length,
    storiesDone: stories.filter((s) => s.status === "done").length,
    tasksDone,
    tasksTotal: tasks.length,
    percent: percentOf(tasksDone, tasks.length),
  };
}

/** A feature is done when it has stories and every one is done. */
export function isFeatureDone(f: FeatureSnapshot): boolean {
  return f.stories.length > 0 && f.stories.every((s) => s.status === "done");
}

/** Map a story's status onto the fixed set; empty or unknown values count as `other` (I-2). */
export function statusOf(s: StoryProgress): Status {
  return (STATUS_ORDER as readonly string[]).includes(s.status) && s.status !== "other"
    ? (s.status as Status)
    : "other";
}

/** Story count per status, in display order, zero entries omitted (FR-003). */
export function statusCounts(features: FeatureSnapshot[]): Partial<Record<Status, number>> {
  const counts: Partial<Record<Status, number>> = {};
  const all = features.flatMap((f) => f.stories);
  for (const status of STATUS_ORDER) {
    const n = all.filter((s) => statusOf(s) === status).length;
    if (n > 0) counts[status] = n;
  }
  return counts;
}

/**
 * The furthest workflow step a feature has reached (ui.md US-5 PhaseLabel, I-7). A missing `ui.md`
 * never blocks later phases.
 */
export function phaseOf(f: FeatureSnapshot): Phase {
  if (isFeatureDone(f)) return "done";
  if (f.tasks !== null) return f.tasks.some((t) => t.done) ? "implementing" : "tasked";
  if (f.artifacts.plan) return "planned";
  if (f.artifacts.ui) return "designed";
  return "specified";
}

/** One row of the feature completion chart (FR-004, FR-005, FR-010). */
export function featureRow(f: FeatureSnapshot): FeatureRow {
  const tasks = f.tasks ? { done: f.tasks.filter((t) => t.done).length, total: f.tasks.length } : null;
  const row: FeatureRow = {
    ref: f.displayRef,
    name: f.dir,
    tasks,
    percent: tasks ? percentOf(tasks.done, tasks.total) : null,
    phase: phaseOf(f),
    clarifications: f.clarifications.length,
  };
  // Only worktree rows carry their source, so output without worktrees is unchanged (017 FR-007/FR-008).
  if (f.checkout?.kind === "worktree") row.checkout = f.checkout;
  return row;
}

/** Feature-qualified, unambiguous story key for display, e.g. `014:US-3` or `008-alpha:US-1`. */
export function storyLabel(f: FeatureSnapshot, s: StoryProgress): string {
  return `${f.displayRef}:${s.displayId}`;
}

interface Node {
  feature: FeatureSnapshot;
  story: StoryProgress;
}

/**
 * Index stories by a collision-safe key (`dir:id`). `StoryProgress.key` uses the feature number,
 * which two `008-*` features share, so the overview keys by directory instead.
 */
function indexStories(features: FeatureSnapshot[]): Map<string, Node> {
  const index = new Map<string, Node>();
  for (const feature of features) {
    for (const story of feature.stories) index.set(`${feature.dir}:${story.id}`, { feature, story });
  }
  return index;
}

/** Resolve a dependency to a node key: bare ids stay in the story's feature; `NNN:US-1` targets NNN. */
function resolveDep(features: FeatureSnapshot[], from: FeatureSnapshot, dep: string): string {
  const qualified = /^(\d+)[:/]?(US\d+)$/.exec(canonicalStoryId(dep));
  if (qualified) {
    const target = features.find((f) => f.ref === qualified[1]);
    return `${target?.dir ?? qualified[1]}:${qualified[2]}`;
  }
  return `${from.dir}:${canonicalStoryId(dep)}`;
}

/** How a dependency target reads from the referencing story: local id, or qualified when cross-feature. */
function depLabel(from: FeatureSnapshot, target: Node | undefined, dep: string): string {
  if (!target) return prettyId(dep);
  return target.feature.dir === from.dir ? target.story.displayId : storyLabel(target.feature, target.story);
}

/** Keys of every node that sits on a dependency cycle (DFS with coloring). */
function cycleKeys(index: Map<string, Node>, edges: (n: Node) => string[]): Set<string> {
  const color = new Map<string, number>();
  const stack: string[] = [];
  const onCycle = new Set<string>();
  const visit = (key: string): void => {
    color.set(key, 1);
    stack.push(key);
    for (const next of edges(index.get(key)!)) {
      if (!index.has(next)) continue;
      const c = color.get(next) ?? 0;
      if (c === 1) for (const k of stack.slice(stack.indexOf(next))) onCycle.add(k);
      else if (c === 0) visit(next);
    }
    stack.pop();
    color.set(key, 2);
  };
  for (const key of index.keys()) if (!color.has(key)) visit(key);
  return onCycle;
}

/**
 * Attention items for the scoped stories (FR-007, FR-008, I-4): graph problems first, then blocked
 * (status `blocked` or a `blocked-by` target not done — done blockers are dropped), then waiting (a
 * `depends-on` target not done). Each story appears once, in its highest-ranked kind.
 */
export function attentionItems(all: FeatureSnapshot[], scoped: FeatureSnapshot[]): AttentionItem[] {
  const index = indexStories(all);
  const deps = (n: Node, list: string[]): string[] => list.map((d) => resolveDep(all, n.feature, d));
  const onCycle = cycleKeys(index, (n) => deps(n, [...n.story.dependsOn, ...n.story.blockedBy]));
  const isDone = (key: string): boolean => index.get(key)?.story.status === "done";

  const problems: AttentionItem[] = [];
  const blocked: AttentionItem[] = [];
  const waiting: AttentionItem[] = [];
  for (const feature of scoped) {
    for (const story of feature.stories) {
      if (story.status === "done") continue;
      const key = storyLabel(feature, story);
      const node = { feature, story };
      const label = (dep: string): string => depLabel(feature, index.get(resolveDep(all, feature, dep)), dep);

      const refs = [
        ...story.dependsOn.map((dep) => ({ field: "depends-on", dep })),
        ...story.blockedBy.map((dep) => ({ field: "blocked-by", dep })),
      ];
      const unknown = refs.filter((r) => !index.has(resolveDep(all, feature, r.dep)));
      if (unknown.length > 0) {
        problems.push({
          key,
          kind: "graph-problem",
          refs: unknown.map((r) => prettyId(r.dep)),
          reason: `${unknown.map((r) => `${r.field} ${prettyId(r.dep)}`).join(", ")} — unknown story`,
        });
        continue;
      }
      const selfKey = `${feature.dir}:${story.id}`;
      if (onCycle.has(selfKey)) {
        const refs = deps(node, [...story.dependsOn, ...story.blockedBy])
          .filter((k) => onCycle.has(k))
          .map((k) => depLabel(feature, index.get(k), k));
        problems.push({ key, kind: "graph-problem", refs, reason: `dependency cycle with ${refs.join(", ")}` });
        continue;
      }
      const openBlockers = story.blockedBy.filter((d) => !isDone(resolveDep(all, feature, d))).map(label);
      if (story.status === "blocked" || openBlockers.length > 0) {
        blocked.push({
          key,
          kind: "blocked",
          refs: openBlockers,
          reason: openBlockers.length > 0 ? `blocked-by ${openBlockers.join(", ")}` : "status: blocked",
        });
        continue;
      }
      const openDeps = story.dependsOn.filter((d) => !isDone(resolveDep(all, feature, d))).map(label);
      if (openDeps.length > 0) {
        waiting.push({ key, kind: "waiting", refs: openDeps, reason: `waiting on ${openDeps.join(", ")}` });
      }
    }
  }
  return [...problems, ...blocked, ...waiting];
}

/**
 * Next ready tasks (FR-009, I-6): undone tasks whose story is not in Attention (unassigned tasks
 * allowed), in feature order then `T###`, capped. `allDone` means nothing is left open at all.
 */
export function upNext(
  scoped: FeatureSnapshot[],
  attention: AttentionItem[],
  cap: number,
): Overview["upNext"] {
  const held = new Set(attention.map((a) => a.key));
  const candidates: UpNextItem[] = [];
  let open = 0;
  for (const feature of scoped) {
    const byId = new Map(feature.stories.map((s) => [s.id, s]));
    const tasks = [...(feature.tasks ?? [])].sort((a, b) => taskNumber(a) - taskNumber(b));
    for (const t of tasks) {
      if (t.done) continue;
      open += 1;
      const story = t.story ? byId.get(t.story) : undefined;
      const storyKey = story ? storyLabel(feature, story) : null;
      if (storyKey && held.has(storyKey)) continue;
      candidates.push({ taskId: t.id, storyKey, description: t.description, feature: feature.dir });
    }
  }
  return { items: candidates.slice(0, Math.max(0, cap)), eligible: candidates.length, allDone: open === 0 };
}

/** Canonical ids (`US9`, `014US2`) back to their written form (`US-9`, `014:US-2`). */
function prettyId(id: string): string {
  const m = /^(?:(\d+))?US(\d+)$/.exec(id);
  return m ? `${m[1] ? `${m[1]}:` : ""}US-${m[2]}` : id;
}

function taskNumber(t: TaskLine): number {
  return Number(t.id.slice(1)) || 0;
}

function percentOf(done: number, total: number): number | null {
  return total === 0 ? null : Math.round((done / total) * 100);
}

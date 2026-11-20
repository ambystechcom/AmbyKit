import type { StoryProgress, TaskLine } from "./dashboard.js";
import { buildGraph, nodeKey } from "./graph.js";
import type { StoryEdge } from "./graph-types.js";
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
  if (filters.search) {
    const q = filters.search.toLowerCase();
    out = out.filter((x) => x.dir.toLowerCase().includes(q) || x.ref.toLowerCase().includes(q));
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
  if (f.lanes && f.lanes.length > 0) row.lanes = f.lanes;
  // Feature 020: undone tasks carrying a BLOCKED marker; omitted when zero so existing output is unchanged.
  const blockedTasks = openBlockedTasks(f).length;
  if (blockedTasks > 0) row.blocked = blockedTasks;
  // Feature 020: Verify lines by state; omitted when the feature has no Verify lines at all.
  const verify = verifyCounts(f);
  if (verify) row.verify = verify;
  // Feature 024: covered/total requirements; omitted without requirements so existing output is unchanged.
  if (f.coverage) row.coverage = { covered: f.coverage.covered, total: f.coverage.total };
  return row;
}

/**
 * Feature 020 (FR-010): count the verifiable phases (at least one task) by Verify state. `verified` has a
 * last result of passed, `failed` has a last result of failed, `missing` has no Verify line. A phase with a
 * Verify line but no result yet (or `? unverified`) is in none of the three. Undefined when no phase has a
 * Verify line, so features without any keep their existing output.
 */
function verifyCounts(f: FeatureSnapshot): { verified: number; failed: number; missing: number } | undefined {
  const phases = (f.verify ?? []).filter((p) => p.tasks > 0);
  if (!phases.some((p) => p.check !== undefined)) return undefined;
  return {
    verified: phases.filter((p) => p.check !== undefined && p.result === "passed").length,
    failed: phases.filter((p) => p.check !== undefined && p.result === "failed").length,
    missing: phases.filter((p) => p.check === undefined).length,
  };
}

/**
 * Feature 020: tasks still open that carry a BLOCKED marker. A checked task with a leftover marker is an
 * inconsistency (FR-004), reported by `analyze`, and never counts as blocked here.
 */
function openBlockedTasks(f: FeatureSnapshot): TaskLine[] {
  return (f.tasks ?? []).filter((t) => !t.done && t.blocked !== undefined);
}

/** Feature-qualified, unambiguous story key for display, e.g. `014:US-3` or `008-alpha:US-1`. */
export function storyLabel(f: FeatureSnapshot, s: StoryProgress): string {
  return `${f.displayRef}:${s.displayId}`;
}

/**
 * Attention items for the scoped stories (FR-007, FR-008, I-4): graph problems first, then blocked
 * (status `blocked` or a `blocked-by` target not done — done blockers are dropped), then waiting (a
 * `depends-on` target not done). Each story appears once, in its highest-ranked kind.
 */
export function attentionItems(all: FeatureSnapshot[], scoped: FeatureSnapshot[]): AttentionItem[] {
  // Dependencies come from the shared graph (feature 023): this function only ranks them.
  const graph = buildGraph(all);
  const nodes = new Map(graph.nodes.map((n) => [n.key, n]));
  const edgesFrom = new Map<string, StoryEdge[]>();
  for (const e of graph.edges) edgesFrom.set(e.from, [...(edgesFrom.get(e.from) ?? []), e]);
  const brokenFrom = new Map<string, typeof graph.broken>();
  for (const b of graph.broken) brokenFrom.set(b.from, [...(brokenFrom.get(b.from) ?? []), b]);
  const onCycle = new Set(graph.cycles.flatMap((c) => c.stories));
  const isDone = (key: string): boolean => nodes.get(key)?.status === "done";
  /** How a dependency target reads from the referencing story: local id, or qualified when cross-feature. */
  const labelOf = (from: FeatureSnapshot, key: string): string => {
    const n = nodes.get(key);
    if (!n) return key;
    return n.feature === from.dir ? n.story : n.id;
  };

  const problems: AttentionItem[] = [];
  const blocked: AttentionItem[] = [];
  const waiting: AttentionItem[] = [];
  const taskBlocked: AttentionItem[] = [];
  const verifyFailed: AttentionItem[] = [];
  for (const feature of scoped) {
    // Feature 020 (FR-010): one item per phase whose last recorded Verify failed; a phase is named `phase-N`.
    for (const phase of feature.verify ?? []) {
      if (phase.tasks === 0 || phase.check === undefined || phase.result !== "failed") continue;
      verifyFailed.push({
        key: `${feature.displayRef}:phase-${phase.phase}`,
        kind: "verify-failed",
        refs: [`phase-${phase.phase}`],
        reason: phase.why ? `verify failed: ${phase.why}` : "verify failed",
      });
    }
    // Feature 020 (FR-010): one item per open task with a BLOCKED marker, keyed by feature and task id.
    for (const task of openBlockedTasks(feature)) {
      taskBlocked.push({
        key: `${feature.displayRef}:${task.id}`,
        kind: "task-blocked",
        refs: [task.id],
        reason: task.blocked ? `BLOCKED: ${task.blocked}` : "BLOCKED (no reason given)",
      });
    }
    for (const story of feature.stories) {
      if (story.status === "done") continue;
      const key = storyLabel(feature, story);
      const self = nodeKey(feature.dir, story.id);
      const edges = edgesFrom.get(self) ?? [];

      const unknown = brokenFrom.get(self) ?? [];
      if (unknown.length > 0) {
        problems.push({
          key,
          kind: "graph-problem",
          refs: unknown.map((b) => prettyId(b.to)),
          reason: `${unknown.map((b) => `${b.kind} ${prettyId(b.to)}`).join(", ")} — unknown story`,
        });
        continue;
      }
      if (onCycle.has(self)) {
        const refs = edges.filter((e) => onCycle.has(e.to)).map((e) => labelOf(feature, e.to));
        problems.push({ key, kind: "graph-problem", refs, reason: `dependency cycle with ${refs.join(", ")}` });
        continue;
      }
      const openBlockers = edges
        .filter((e) => e.kind === "blocked-by" && !isDone(e.to))
        .map((e) => labelOf(feature, e.to));
      if (story.status === "blocked" || openBlockers.length > 0) {
        blocked.push({
          key,
          kind: "blocked",
          refs: openBlockers,
          reason: openBlockers.length > 0 ? `blocked-by ${openBlockers.join(", ")}` : "status: blocked",
        });
        continue;
      }
      const openDeps = edges
        .filter((e) => e.kind === "depends-on" && !isDone(e.to))
        .map((e) => labelOf(feature, e.to));
      if (openDeps.length > 0) {
        waiting.push({ key, kind: "waiting", refs: openDeps, reason: `waiting on ${openDeps.join(", ")}` });
      }
    }
  }
  return [...problems, ...blocked, ...waiting, ...taskBlocked, ...verifyFailed];
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
      // Feature 020: a task marked BLOCKED is not offered as ready work; lane planning is unchanged.
      if (t.blocked !== undefined) continue;
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

import {
  computeDashboard,
  displayKey,
  parseDeclaredPaths,
  storyKey,
  type StoryProgress,
  type TaskLine,
} from "./dashboard.js";
import { readFeatures } from "./features.js";
import type { PhaseVerify } from "./markers.js";
import { buildGraph, nodeKey, parseDependencyRef } from "./graph.js";
import { blockersOf } from "./graph-paths.js";
import { declarations, laneConflicts, type Declaration, type LaneConflict } from "./lanes.js";
import type { FeatureSnapshot } from "./overview-types.js";

export interface GraphIssue {
  kind: "cycle" | "dangling-reference";
  message: string;
  stories: string[]; // qualified keys involved (featureRef:id)
}

export interface BlockedStory {
  key: string; // qualified, e.g. "002:US1"
  displayId: string; // qualified, e.g. "002:US-1"
  feature: string;
  on: string[]; // qualified display ids of unmet blockers
}

/** Feature 020: a task carrying a BLOCKED marker (not the same as a story blocked by dependencies). */
export interface BlockedTask {
  feature: string; // display ref of the feature
  task: string; // T###
  story: string | null;
  reason: string; // "" = marked blocked with no reason
}

/** Feature 020: a task carrying a DEVIATION note. */
export interface DeviationNote {
  feature: string;
  task: string;
  note: string;
}

/** Feature 020: a marker that is present but malformed or contradictory. */
export interface MarkerIssue {
  feature: string;
  task: string;
  kind: "missing-reason" | "checked-but-blocked" | "path-after-marker";
  message: string;
}

/** Feature 020 (FR-009): a phase whose Verify line is missing or whose last recorded result failed. */
export interface VerifyIssue {
  feature: string;
  /** Stable phase id: `<feature>:phase-N` (phases have no other id). */
  phase: string;
  title: string;
  kind: "missing" | "failed";
  /** Reason after `✗ failed:`; only for kind "failed", may be empty. */
  why?: string;
}

export interface AnalysisReport {
  total: number;
  issues: GraphIssue[]; // structural errors (cycles, dangling refs)
  blocked: BlockedStory[];
  buildable: string[]; // qualified display ids: not done, all blockers done
  orphans: string[]; // qualified display ids: no tasks
  /** Feature 015: parallel-lane ownership check over every feature's open tasks. */
  lanes: { conflicts: LaneConflict[]; declarations: Declaration[] };
  /** Feature 020: BLOCKED-marked tasks. Present only when there is at least one (warnings only). */
  blockedTasks?: BlockedTask[];
  /** Feature 020: DEVIATION notes. Present only when there is at least one. */
  deviations?: DeviationNote[];
  /** Feature 020: marker problems (empty reason, checked-but-blocked). Present only when any. */
  markerIssues?: MarkerIssue[];
  /** Feature 020: phases with no Verify line (features not yet done) or a failed last Verify. Present only when any (warnings only). */
  verifyIssues?: VerifyIssue[];
}

/** Combined hard dependencies of a story (depends-on ∪ blocked-by), deduped, as local ids. */
export function storyDeps(s: StoryProgress): string[] {
  return Array.from(new Set([...s.dependsOn, ...s.blockedBy]));
}

/**
 * Resolve a story's dependency to a globally-unique key. Story ids restart per feature, so a bare
 * dependency (e.g. `US-1`) resolves within the story's own feature. A dependency written as
 * `NNN:US-1` / `NNN/US-1` targets another feature explicitly. The syntax is read by `parseDependencyRef`
 * (feature 023); this wrapper only keeps the public name.
 */
export function resolveDepKey(s: StoryProgress, dep: string): string {
  const { ref, local } = parseDependencyRef(dep);
  return storyKey(ref ?? s.featureRef, local);
}

/** The minimal feature snapshots `buildGraph` needs, from a flat story list grouped by feature. */
function snapshotsOf(stories: StoryProgress[]): FeatureSnapshot[] {
  const byFeature = new Map<string, FeatureSnapshot>();
  for (const s of stories) {
    let f = byFeature.get(s.feature);
    if (!f) {
      f = {
        dir: s.feature,
        ref: s.featureRef,
        displayRef: s.featureRef,
        stories: [],
        tasks: null,
        artifacts: { spec: true, ui: false, uiSignedOff: false, plan: false, tasks: false },
        clarifications: [],
      };
      byFeature.set(s.feature, f);
    }
    f.stories.push(s);
  }
  return [...byFeature.values()];
}

/**
 * Validate the story dependency graph. Pure — no filesystem, no model tokens. Dependencies come from
 * the shared graph (feature 023): this function only turns the graph into the findings `analyze` has
 * always reported, so those findings do not change (FR-017).
 */
export function analyzeGraph(stories: StoryProgress[]): AnalysisReport {
  const graph = buildGraph(snapshotsOf(stories));
  const storyOfNode = new Map<string, StoryProgress>();
  for (const s of stories) {
    const key = nodeKey(s.feature, s.id);
    if (!storyOfNode.has(key)) storyOfNode.set(key, s);
  }
  const display = (key: string): string => {
    const s = storyOfNode.get(key);
    return s ? displayKey(s) : key;
  };
  const issues: GraphIssue[] = [];

  // Dangling references: a dependency that names a story that does not exist.
  const brokenFrom = new Map<string, typeof graph.broken>();
  for (const b of graph.broken) brokenFrom.set(b.from, [...(brokenFrom.get(b.from) ?? []), b]);
  for (const s of stories) {
    const key = nodeKey(s.feature, s.id);
    if (storyOfNode.get(key) !== s) continue;
    const seen = new Set<string>();
    for (const b of brokenFrom.get(key) ?? []) {
      if (seen.has(b.to)) continue;
      seen.add(b.to);
      issues.push({
        kind: "dangling-reference",
        message: `${displayKey(s)} references unknown story ${b.to}`,
        stories: [s.key, resolveDepKey(s, b.to)],
      });
    }
  }

  // Cycles: one finding naming every story on any cycle.
  const members: string[] = [];
  const inCycle = new Set<string>();
  for (const c of graph.cycles) {
    for (const k of c.stories) {
      if (!inCycle.has(k)) {
        inCycle.add(k);
        members.push(k);
      }
    }
  }
  if (members.length > 0) {
    issues.push({
      kind: "cycle",
      message: `Dependency cycle among ${members.map(display).join(", ")}`,
      stories: members.map((k) => storyOfNode.get(k)?.key ?? k),
    });
  }

  // Blocked vs buildable.
  const blocked: BlockedStory[] = [];
  const buildable: string[] = [];
  for (const s of stories) {
    if (s.status === "done") continue;
    const unmet = blockersOf(graph, nodeKey(s.feature, s.id));
    if (unmet.length > 0) {
      blocked.push({
        key: s.key,
        displayId: displayKey(s),
        feature: s.feature,
        on: unmet.map((b) => (b.broken ? resolveDepKey(s, b.key) : display(b.key))),
      });
    } else {
      buildable.push(displayKey(s));
    }
  }

  const orphans = stories.filter((s) => s.tasksTotal === 0).map((s) => displayKey(s));

  return { total: stories.length, issues, blocked, buildable, orphans, lanes: { conflicts: [], declarations: [] } };
}

/**
 * Feature 020 (FR-009): collect BLOCKED markers, DEVIATION notes and marker problems from one
 * feature's task lines. A checked task that still carries BLOCKED is an inconsistency, not a block.
 */
function collectMarkers(
  feature: string,
  tasks: TaskLine[],
  blockedTasks: BlockedTask[],
  deviations: DeviationNote[],
  markerIssues: MarkerIssue[],
): void {
  for (const t of tasks) {
    if (t.blocked !== undefined) {
      if (t.done) {
        markerIssues.push({
          feature,
          task: t.id,
          kind: "checked-but-blocked",
          message: `${feature}:${t.id} is checked but still carries a BLOCKED marker`,
        });
      } else {
        blockedTasks.push({ feature, task: t.id, story: t.story, reason: t.blocked });
        if (t.blocked === "") {
          markerIssues.push({
            feature,
            task: t.id,
            kind: "missing-reason",
            message: `${feature}:${t.id} is BLOCKED with no reason`,
          });
        }
      }
    }
    if (t.deviation !== undefined) deviations.push({ feature, task: t.id, note: t.deviation });
    // A marker placed before the `(file/path)` group swallows the path into its text: the task then
    // silently loses its file ownership for lane planning. Markers belong after the path group.
    if (!t.done && t.paths.length === 0) {
      for (const text of [t.blocked, t.deviation]) {
        if (text && parseDeclaredPaths(text).paths.length > 0) {
          markerIssues.push({
            feature,
            task: t.id,
            kind: "path-after-marker",
            message: `${feature}:${t.id} has a (file/path) group after its marker; put markers last so the paths count as ownership`,
          });
          break;
        }
      }
    }
  }
}

/**
 * Feature 020 (FR-009, FR-011): phases without a Verify line and phases whose last Verify failed.
 * Missing-Verify findings apply only to features that are not yet done (some task still open), so a
 * finished feature that predates the convention stays quiet. Both are warnings, never errors.
 */
function collectVerifyIssues(feature: string, tasks: TaskLine[], verify: PhaseVerify[], out: VerifyIssue[]): void {
  const featureDone = tasks.length > 0 && tasks.every((t) => t.done);
  for (const v of verify) {
    if (v.tasks === 0) continue; // a heading with no tasks is not a verifiable phase
    const phase = `${feature}:phase-${v.phase}`;
    if (v.check === undefined) {
      if (!featureDone) out.push({ feature, phase, title: v.title, kind: "missing" });
    } else if (v.result === "failed") {
      out.push({ feature, phase, title: v.title, kind: "failed", why: v.why ?? "" });
    }
  }
}

/** Convenience: analyze a project by reading its specs/. */
export function analyzeProject(projectRoot: string): AnalysisReport {
  const report = analyzeGraph(computeDashboard(projectRoot));
  const blockedTasks: BlockedTask[] = [];
  const deviations: DeviationNote[] = [];
  const markerIssues: MarkerIssue[] = [];
  const verifyIssues: VerifyIssue[] = [];
  for (const f of readFeatures(projectRoot).features) {
    if (f.tasks === null) continue;
    report.lanes.conflicts.push(...laneConflicts(f.dir, f.tasks));
    report.lanes.declarations.push(...declarations(f.dir, f.tasks));
    collectMarkers(f.displayRef, f.tasks, blockedTasks, deviations, markerIssues);
    if (f.verify) collectVerifyIssues(f.displayRef, f.tasks, f.verify, verifyIssues);
  }
  // New keys appear only when there is something to say, so output without markers is unchanged.
  if (blockedTasks.length > 0) report.blockedTasks = blockedTasks;
  if (deviations.length > 0) report.deviations = deviations;
  if (markerIssues.length > 0) report.markerIssues = markerIssues;
  if (verifyIssues.length > 0) report.verifyIssues = verifyIssues;
  return report;
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeProject, type AnalysisReport } from "./analyze.js";
import { primaryRoot } from "./checkouts.js";
import { canonicalStoryId, parseTasks, type TaskLine } from "./dashboard.js";
import { readFeatures } from "./features.js";
import { buildGraph } from "./graph.js";
import { blockersOf } from "./graph-paths.js";
import type { DependencyGraph, StoryNode } from "./graph-types.js";
import { matchLane, readManifest, type LaneManifest } from "./lanes.js";
import type { FeatureSnapshot } from "./overview-types.js";
import { WORKTREES_DIR } from "./worktree.js";

/**
 * Read-only state queries for the MCP server (feature 025, US-1). Every answer is a capped slice built
 * from the existing parsers and the dependency graph (`buildable`/`blockersOf` of spec 023), so an
 * assistant never reads a whole `tasks.md` or spec to learn what is next (SC-001). Errors name what was not
 * found (FR-002); nothing here writes.
 */

export type Failed = { error: string };
export const failed = (error: string): Failed => ({ error });
export const isFailed = (x: unknown): x is Failed => typeof x === "object" && x !== null && "error" in x;

const TEXT_CAP = 160;
export const LANE_TASK_CAP = 40;
export const FINDINGS_CAP = 25;

const clip = (s: string, n = TEXT_CAP): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A task's text without its trailing file-ownership group, which is returned separately as `paths`. */
function taskText(t: TaskLine, cap = TEXT_CAP): string {
  const text = t.paths.length > 0 || t.pathIssue === "glob" ? t.description.replace(/\s*\([^()]*\)\s*$/, "") : t.description;
  return clip(text, cap);
}

/** A project's features and its graph, read once per call. */
export interface Project {
  features: FeatureSnapshot[];
  graph: DependencyGraph;
}

export function loadProject(root: string): Project {
  const { features } = readFeatures(root);
  return { features, graph: buildGraph(features) };
}

/** Find a feature by number (`025`), directory name, or display ref; the error names the choices. */
export function findFeature(project: Project, ref: string): FeatureSnapshot | Failed {
  const hit = project.features.find((f) => f.dir === ref) ?? project.features.find((f) => f.ref === ref || f.displayRef === ref);
  if (hit) return hit;
  const known = project.features.map((f) => f.dir);
  return failed(`feature '${ref}' not found${known.length ? `; known: ${known.slice(-8).join(", ")}` : ""}`);
}

/** The story node a task belongs to, if its story is declared in the spec. */
function storyNode(project: Project, feature: FeatureSnapshot, task: TaskLine): StoryNode | undefined {
  if (!task.story) return undefined;
  return project.graph.nodes.find((n) => n.feature === feature.dir && n.key === `${feature.dir}:${task.story}`);
}

/** The readable name of a blocker key (`NNN:US-#`), or the reference as written when it does not resolve. */
function blockerName(project: Project, key: string, broken: boolean): string {
  if (broken) return key.replace(/^(.+?)US(\d+)$/, "$1:US-$2"); // the graph keeps a broken reference in canonical form (`009US1`)
  return project.graph.nodes.find((n) => n.key === key)?.id ?? key;
}

// ── lanes ───────────────────────────────────────────────────────────────────────────────────────

export interface LaneRef {
  /** Full name `NNN-slug.lane-p-k`. */
  name: string;
  /** Short form `lane-p-k`. */
  short: string;
  /** The lane's own checkout. */
  root: string;
  manifest: LaneManifest;
}

/** Lane checkouts of a feature, found under the primary checkout's `.worktrees/`. */
export function laneRefs(root: string, feature: string): LaneRef[] {
  const dir = join(primaryRoot(root), WORKTREES_DIR);
  if (!existsSync(dir)) return [];
  const out: LaneRef[] = [];
  const prefix = `${feature}.lane-`;
  for (const name of safeReaddir(dir)) {
    if (!name.startsWith(prefix)) continue;
    const manifest = readManifest(join(dir, name));
    if (manifest) out.push({ name, short: name.slice(feature.length + 1), root: join(dir, name), manifest });
  }
  return out;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * Resolve the lane a call means: the one named (`lane-1-2`, `1-2` or the full name), else the lane this
 * server is running in. `null` means "no lane" (the whole feature); a named lane that does not exist is an error.
 */
export function resolveLane(root: string, feature: string, laneArg?: string): LaneRef | null | Failed {
  const lanes = laneRefs(root, feature);
  if (laneArg) {
    const name = matchLane(feature, lanes.map((l) => l.name), laneArg);
    const hit = lanes.find((l) => l.name === name);
    if (hit) return hit;
    return failed(`lane '${laneArg}' not found for ${feature}${lanes.length ? `; lanes: ${lanes.map((l) => l.short).join(", ")}` : "; it has no lanes"}`);
  }
  const own = readManifest(root);
  if (own && own.feature === feature) return { name: own.lane, short: own.lane.slice(feature.length + 1), root, manifest: own };
  return null;
}

// ── next_task ───────────────────────────────────────────────────────────────────────────────────

export interface NextTask {
  id: string;
  text: string;
  paths: string[];
  story: string | null;
}
export type NextTaskAnswer = NextTask | { none: "done" | "all blocked"; why: string } | Failed;

/**
 * The first unchecked task, in file order, that is not marked BLOCKED and whose story has no unmet
 * blocker. Given a lane, only that lane's tasks are considered. "Unblocked" is the graph's `blockersOf`.
 */
export function nextTask(root: string, featureRef: string, laneArg?: string): NextTaskAnswer {
  const project = loadProject(root);
  const feature = findFeature(project, featureRef);
  if (isFailed(feature)) return feature;
  const lane = resolveLane(root, feature.dir, laneArg);
  if (isFailed(lane)) return lane;
  const tasks = (feature.tasks ?? []).filter((t) => !lane || lane.manifest.tasks.some((m) => m.id === t.id));
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) return { none: "done", why: `all ${tasks.length} task(s) are checked` };

  const reasons: string[] = [];
  for (const t of open) {
    if (t.blocked !== undefined) {
      reasons.push(`${t.id} is marked BLOCKED${t.blocked ? `: ${clip(t.blocked, 60)}` : ""}`);
      continue;
    }
    const node = storyNode(project, feature, t);
    const blockers = node ? blockersOf(project.graph, node.key) : [];
    if (blockers.length > 0) {
      reasons.push(`${t.id} waits on ${blockers.map((b) => blockerName(project, b.key, b.broken)).join(", ")}`);
      continue;
    }
    return { id: t.id, text: taskText(t), paths: t.paths, story: node?.story ?? null };
  }
  return { none: "all blocked", why: clip(reasons.slice(0, 3).join("; "), 300) };
}

// ── story_status ────────────────────────────────────────────────────────────────────────────────

export interface StoryStatus {
  story: string;
  status: string;
  priority: string;
  blockers: string[];
}

export function storyStatus(root: string, featureRef: string, storyRef: string): StoryStatus | Failed {
  const project = loadProject(root);
  const feature = findFeature(project, featureRef);
  if (isFailed(feature)) return feature;
  const wanted = canonicalStoryId(storyRef.includes(":") ? storyRef.slice(storyRef.lastIndexOf(":") + 1) : storyRef);
  const node = project.graph.nodes.find((n) => n.key === `${feature.dir}:${wanted}`);
  if (!node) {
    const have = project.graph.nodes.filter((n) => n.feature === feature.dir).map((n) => n.story);
    return failed(`story '${storyRef}' not found in ${feature.dir}${have.length ? `; stories: ${have.join(", ")}` : ""}`);
  }
  return {
    story: node.story,
    status: node.status || "unset",
    priority: node.priority,
    blockers: blockersOf(project.graph, node.key).map((b) => blockerName(project, b.key, b.broken)),
  };
}

// ── lane_tasks ──────────────────────────────────────────────────────────────────────────────────

export interface LaneTasks {
  lane: string | null;
  tasks: { id: string; done: boolean; text: string }[];
  truncated?: true;
}

/** A lane's task slice (with progress read from the lane's own checkout), or the feature's when there is no lane. */
export function laneTasks(root: string, featureRef: string, laneArg?: string): LaneTasks | Failed {
  const project = loadProject(root);
  const feature = findFeature(project, featureRef);
  if (isFailed(feature)) return feature;
  const lane = resolveLane(root, feature.dir, laneArg);
  if (isFailed(lane)) return lane;

  let source: TaskLine[] = feature.tasks ?? [];
  if (lane) {
    const own = join(lane.root, "specs", feature.dir, "tasks.md");
    if (existsSync(own)) source = parseTasks(readFileSync(own, "utf8"));
    const ids = new Set(lane.manifest.tasks.map((m) => m.id));
    source = source.filter((t) => ids.has(t.id));
  }
  const slice = source.slice(0, LANE_TASK_CAP).map((t) => ({ id: t.id, done: t.done, text: taskText(t, 100) }));
  return { lane: lane ? lane.short : null, tasks: slice, ...(source.length > LANE_TASK_CAP ? { truncated: true as const } : {}) };
}

// ── analyze_report ──────────────────────────────────────────────────────────────────────────────

export interface AnalyzeSlice {
  feature?: string;
  issues: AnalysisReport["issues"];
  blocked: AnalysisReport["blocked"];
  buildable: string[];
  orphans: string[];
  laneConflicts: unknown[];
  blockedTasks: NonNullable<AnalysisReport["blockedTasks"]>;
  deviations: NonNullable<AnalysisReport["deviations"]>;
  markerIssues: NonNullable<AnalysisReport["markerIssues"]>;
  verifyIssues: NonNullable<AnalysisReport["verifyIssues"]>;
  testDesign: unknown[];
  decisions: unknown[];
  truncated?: true;
}

/** The findings of `ambykit analyze --json`, sliced to one feature when given and capped per list. */
export function analyzeSlice(root: string, featureRef?: string): AnalyzeSlice | Failed {
  let ref: string | undefined;
  let dir: string | undefined;
  if (featureRef) {
    const project = loadProject(root);
    const feature = findFeature(project, featureRef);
    if (isFailed(feature)) return feature;
    ref = feature.displayRef;
    dir = feature.dir;
  }
  const report = analyzeProject(root);
  const mine = <T extends { feature: string }>(xs: T[] | undefined): T[] => (xs ?? []).filter((x) => !ref || x.feature === ref || x.feature === dir);
  const keyOf = (display: string): boolean => !ref || display.startsWith(`${ref}:`);
  let truncated = false;
  const cap = <T>(xs: T[]): T[] => {
    if (xs.length > FINDINGS_CAP) truncated = true;
    return xs.slice(0, FINDINGS_CAP);
  };
  const slice: AnalyzeSlice = {
    ...(ref ? { feature: dir } : {}),
    issues: cap(report.issues.filter((i) => !ref || i.stories.some((s) => s.startsWith(`${ref}:`)))),
    blocked: cap(mine(report.blocked)),
    buildable: cap(report.buildable.filter(keyOf)),
    orphans: cap(report.orphans.filter(keyOf)),
    laneConflicts: cap(report.lanes.conflicts.filter((c) => !ref || (c as { feature?: string }).feature === dir)),
    blockedTasks: cap(mine(report.blockedTasks)),
    deviations: cap(mine(report.deviations)),
    markerIssues: cap(mine(report.markerIssues)),
    verifyIssues: cap(mine(report.verifyIssues)),
    testDesign: cap(mine(report.testDesign?.findings)),
    decisions: cap((report.decisions?.issues ?? []) as unknown[]),
  };
  if (truncated) slice.truncated = true;
  return slice;
}

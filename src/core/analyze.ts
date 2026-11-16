import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { declarations, laneConflicts, type Declaration, type LaneConflict } from "./lanes.js";
import { checkTestDesign, parseTestDesign, type DesignFinding } from "./test-design.js";
import { analyzeDecisions, loadDecisions, type DecisionIssue } from "./decisions.js";

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

/** Feature 021: a test-design finding with the feature it belongs to. */
export interface TestDesignFinding extends DesignFinding {
  feature: string; // display ref of the feature
}

/** Feature 021: what `analyze` knows about the features' `tests.md` files. */
export interface TestDesignReport {
  /** Findings per feature that has a `tests.md` (non-blocking: they never change the exit status). */
  findings: TestDesignFinding[];
  /** Display refs of features with a `spec.md` but no `tests.md`. JSON only; never printed. */
  missing: string[];
}

/** Feature 022: what `analyze` knows about the decision records (`.amby/decisions/`). */
export interface DecisionsReport {
  records: { id: string; title: string; status: string }[];
  /** Errors (dangling citation, supersede problems, accepted-with-conflict) fail the exit status; warnings do not. */
  issues: DecisionIssue[];
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
  /**
   * Feature 021: test-design findings and the features that have none. Present only when at least one
   * feature has a `tests.md`, so a project without test design reports exactly what it did before.
   */
  testDesign?: TestDesignReport;
  /**
   * Feature 022: decision records and their issues. Present only when records or `ADR-###` citations
   * exist, so a project without decisions reports exactly what it did before.
   */
  decisions?: DecisionsReport;
}

/** Feature 022: true when decision records have an error-level issue (it joins the exit status). */
export function hasDecisionErrors(report: AnalysisReport): boolean {
  return (report.decisions?.issues ?? []).some((i) => i.level === "error");
}

/** Combined hard dependencies of a story (depends-on ∪ blocked-by), deduped, as local ids. */
export function storyDeps(s: StoryProgress): string[] {
  return Array.from(new Set([...s.dependsOn, ...s.blockedBy]));
}

/**
 * Resolve a story's dependency to a globally-unique key. Story ids restart per feature, so a bare
 * dependency (e.g. `US-1`) resolves within the story's own feature. A dependency written as
 * `NNN:US-1` / `NNN/US-1` targets another feature explicitly.
 */
export function resolveDepKey(s: StoryProgress, dep: string): string {
  const qualified = /^(\d+)[:/]?(US\d+)$/.exec(dep);
  if (qualified) return storyKey(qualified[1] ?? s.featureRef, qualified[2] ?? dep);
  return storyKey(s.featureRef, dep);
}

const displayFor = (byKey: Map<string, StoryProgress>, key: string): string =>
  byKey.has(key) ? displayKey(byKey.get(key)!) : key;

/** Validate the story dependency graph. Pure — no filesystem, no model tokens. */
export function analyzeGraph(stories: StoryProgress[]): AnalysisReport {
  const byKey = new Map(stories.map((s) => [s.key, s]));
  const issues: GraphIssue[] = [];

  // Dangling references (resolved within the referencing story's feature).
  for (const s of stories) {
    for (const dep of storyDeps(s)) {
      const depKey = resolveDepKey(s, dep);
      if (!byKey.has(depKey)) {
        issues.push({
          kind: "dangling-reference",
          message: `${displayKey(s)} references unknown story ${dep}`,
          stories: [s.key, depKey],
        });
      }
    }
  }

  // Cycle detection (DFS with coloring), over qualified keys.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(stories.map((s) => [s.key, WHITE]));
  const stack: string[] = [];
  const cycleNodes = new Set<string>();

  const visit = (key: string): void => {
    color.set(key, GRAY);
    stack.push(key);
    const s = byKey.get(key);
    if (s) {
      for (const dep of storyDeps(s)) {
        const depKey = resolveDepKey(s, dep);
        if (!byKey.has(depKey)) continue;
        const c = color.get(depKey);
        if (c === GRAY) {
          const idx = stack.indexOf(depKey);
          for (const n of stack.slice(idx)) cycleNodes.add(n);
        } else if (c === WHITE) {
          visit(depKey);
        }
      }
    }
    stack.pop();
    color.set(key, BLACK);
  };
  for (const s of stories) {
    if (color.get(s.key) === WHITE) visit(s.key);
  }
  if (cycleNodes.size > 0) {
    const keys = [...cycleNodes];
    issues.push({
      kind: "cycle",
      message: `Dependency cycle among ${keys.map((k) => displayFor(byKey, k)).join(", ")}`,
      stories: keys,
    });
  }

  // Blocked vs buildable.
  const isDone = (s: StoryProgress): boolean => s.status === "done";
  const blocked: BlockedStory[] = [];
  const buildable: string[] = [];
  for (const s of stories) {
    if (isDone(s)) continue;
    const unmet = storyDeps(s).filter((d) => {
      const t = byKey.get(resolveDepKey(s, d));
      return !t || !isDone(t);
    });
    if (unmet.length > 0) {
      blocked.push({
        key: s.key,
        displayId: displayKey(s),
        feature: s.feature,
        on: unmet.map((d) => displayFor(byKey, resolveDepKey(s, d))),
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

/**
 * Feature 021: check one feature's `tests.md` against its `spec.md`. Returns false when the feature has no
 * `tests.md` (nothing is reported for it here). A file that cannot be read counts as absent.
 */
function collectTestDesign(root: string, dir: string, ref: string, out: TestDesignFinding[]): boolean {
  const designPath = join(root, "specs", dir, "tests.md");
  if (!existsSync(designPath)) return false;
  try {
    const design = parseTestDesign(readFileSync(designPath, "utf8"));
    const spec = readFileSync(join(root, "specs", dir, "spec.md"), "utf8");
    for (const f of checkTestDesign(spec, design)) out.push({ feature: ref, ...f });
    return true;
  } catch {
    return false;
  }
}

/** Convenience: analyze a project by reading its specs/. */
export function analyzeProject(projectRoot: string): AnalysisReport {
  const report = analyzeGraph(computeDashboard(projectRoot));
  const blockedTasks: BlockedTask[] = [];
  const deviations: DeviationNote[] = [];
  const markerIssues: MarkerIssue[] = [];
  const verifyIssues: VerifyIssue[] = [];
  const designFindings: TestDesignFinding[] = [];
  const designMissing: string[] = [];
  let designed = 0;
  for (const f of readFeatures(projectRoot).features) {
    if (collectTestDesign(projectRoot, f.dir, f.displayRef, designFindings)) designed += 1;
    else designMissing.push(f.displayRef);
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
  if (designed > 0) report.testDesign = { findings: designFindings, missing: designMissing };
  const decisions = loadDecisions(projectRoot);
  if (decisions.records.length > 0 || decisions.invalid.length > 0 || decisions.citations.length > 0) {
    report.decisions = {
      records: decisions.records.map((r) => ({ id: r.id, title: r.title, status: r.status })),
      issues: analyzeDecisions(decisions),
    };
  }
  return report;
}

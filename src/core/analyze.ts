import { computeDashboard, displayKey, storyKey, type StoryProgress } from "./dashboard.js";

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

export interface AnalysisReport {
  total: number;
  issues: GraphIssue[]; // structural errors (cycles, dangling refs)
  blocked: BlockedStory[];
  buildable: string[]; // qualified display ids: not done, all blockers done
  orphans: string[]; // qualified display ids: no tasks
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
function resolveDepKey(s: StoryProgress, dep: string): string {
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

  return { total: stories.length, issues, blocked, buildable, orphans };
}

/** Convenience: analyze a project by reading its specs/. */
export function analyzeProject(projectRoot: string): AnalysisReport {
  return analyzeGraph(computeDashboard(projectRoot));
}

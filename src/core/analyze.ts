import { computeDashboard, type StoryProgress } from "./dashboard.js";

export interface GraphIssue {
  kind: "cycle" | "dangling-reference";
  message: string;
  stories: string[]; // canonical ids involved
}

export interface BlockedStory {
  id: string;
  displayId: string;
  feature: string;
  on: string[]; // display ids of unmet blockers
}

export interface AnalysisReport {
  total: number;
  issues: GraphIssue[]; // structural errors (cycles, dangling refs)
  blocked: BlockedStory[];
  buildable: string[]; // display ids: not done, all blockers done
  orphans: string[]; // display ids: no tasks
}

/** Combined hard dependencies of a story (depends-on ∪ blocked-by), deduped. */
export function storyDeps(s: StoryProgress): string[] {
  return Array.from(new Set([...s.dependsOn, ...s.blockedBy]));
}

const display = (byId: Map<string, StoryProgress>, id: string): string =>
  byId.get(id)?.displayId ?? id;

/** Validate the story dependency graph. Pure — no filesystem, no model tokens. */
export function analyzeGraph(stories: StoryProgress[]): AnalysisReport {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const issues: GraphIssue[] = [];

  // Dangling references.
  for (const s of stories) {
    for (const dep of storyDeps(s)) {
      if (!byId.has(dep)) {
        issues.push({
          kind: "dangling-reference",
          message: `${s.displayId} references unknown story ${dep}`,
          stories: [s.id, dep],
        });
      }
    }
  }

  // Cycle detection (DFS with coloring).
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(stories.map((s) => [s.id, WHITE]));
  const stack: string[] = [];
  const cycleNodes = new Set<string>();

  const visit = (id: string): void => {
    color.set(id, GRAY);
    stack.push(id);
    const s = byId.get(id);
    if (s) {
      for (const dep of storyDeps(s)) {
        if (!byId.has(dep)) continue;
        const c = color.get(dep);
        if (c === GRAY) {
          const idx = stack.indexOf(dep);
          for (const n of stack.slice(idx)) cycleNodes.add(n);
        } else if (c === WHITE) {
          visit(dep);
        }
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };
  for (const s of stories) {
    if (color.get(s.id) === WHITE) visit(s.id);
  }
  if (cycleNodes.size > 0) {
    const ids = [...cycleNodes];
    issues.push({
      kind: "cycle",
      message: `Dependency cycle among ${ids.map((i) => display(byId, i)).join(", ")}`,
      stories: ids,
    });
  }

  // Blocked vs buildable.
  const isDone = (s: StoryProgress): boolean => s.status === "done";
  const blocked: BlockedStory[] = [];
  const buildable: string[] = [];
  for (const s of stories) {
    if (isDone(s)) continue;
    const unmet = storyDeps(s).filter((d) => {
      const t = byId.get(d);
      return !t || !isDone(t);
    });
    if (unmet.length > 0) {
      blocked.push({
        id: s.id,
        displayId: s.displayId,
        feature: s.feature,
        on: unmet.map((d) => display(byId, d)),
      });
    } else {
      buildable.push(s.displayId);
    }
  }

  const orphans = stories.filter((s) => s.tasksTotal === 0).map((s) => s.displayId);

  return { total: stories.length, issues, blocked, buildable, orphans };
}

/** Convenience: analyze a project by reading its specs/. */
export function analyzeProject(projectRoot: string): AnalysisReport {
  return analyzeGraph(computeDashboard(projectRoot));
}

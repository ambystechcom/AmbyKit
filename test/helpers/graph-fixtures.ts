import type { StoryProgress } from "../../src/core/dashboard.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";

/** Hand-built stories and features for the dependency-graph tests (feature 023). */
export function story(feature: string, id: string, p: Partial<StoryProgress> = {}): StoryProgress {
  const ref = feature.replace(/-.*$/, "");
  return {
    id,
    displayId: p.displayId ?? id.replace(/^US(\d+)$/, "US-$1"),
    featureRef: ref,
    key: `${ref}:${id}`,
    title: p.title ?? id,
    priority: p.priority ?? "P1",
    status: p.status ?? "draft",
    dependsOn: p.dependsOn ?? [],
    blockedBy: p.blockedBy ?? [],
    feature,
    tasksTotal: p.tasksTotal ?? 1,
    tasksDone: p.tasksDone ?? 0,
    percent: p.percent ?? 0,
  };
}

export function feature(dir: string, stories: StoryProgress[], displayRef?: string): FeatureSnapshot {
  const ref = dir.replace(/-.*$/, "");
  return {
    dir,
    ref,
    displayRef: displayRef ?? ref,
    stories,
    tasks: null,
    artifacts: { spec: true, ui: false, uiSignedOff: false, plan: false, tasks: false },
    clarifications: [],
  };
}

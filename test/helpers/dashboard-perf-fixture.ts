import { dashboardFixture, type FeatureDef } from "./dashboard-fixture.js";

/**
 * SC-003 load: `features` features × `storiesPer` stories, ~1,000 tasks in total, mixed statuses
 * and partial completion, with a dependency chain inside each feature.
 */
export function perfFixture(features = 30, storiesPer = 5, tasksPerStory = 7): string {
  const statuses = ["done", "in-progress", "ready", "draft", "blocked"];
  const defs: FeatureDef[] = Array.from({ length: features }, (_, f) => {
    const stories = Array.from({ length: storiesPer }, (_, s) => ({
      id: s + 1,
      status: statuses[(f + s) % statuses.length]!,
      dependsOn: s > 0 ? [`US-${s}`] : [],
    }));
    const tasks: Record<number, [number, number]> = {};
    for (const s of stories) tasks[s.id] = [tasksPerStory, (f * s.id) % (tasksPerStory + 1)];
    return { dir: `${String(f + 1).padStart(3, "0")}-feature-${f + 1}`, stories, tasks, plan: true };
  });
  return dashboardFixture({ features: defs });
}

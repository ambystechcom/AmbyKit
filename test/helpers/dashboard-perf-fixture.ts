import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dashboardFixture, type FeatureDef } from "./dashboard-fixture.js";
import { gitRun } from "./git-repo.js";

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

/**
 * Feature 017 SC-003 load: the perf fixture as a git repo with `worktrees` feature worktrees under
 * `.worktrees/<id>` (real `git worktree add`), each with some extra progress ticked in the worktree.
 */
export function worktreePerfFixture(features = 50, worktrees = 10): string {
  const root = perfFixture(features, 3, 7);
  for (const args of [
    ["init", "-q", "-b", "main"],
    ["config", "user.email", "test@example.com"],
    ["config", "user.name", "Test"],
    ["config", "commit.gpgsign", "false"],
  ]) gitRun(root, args);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\n");
  gitRun(root, ["add", "-A"]);
  gitRun(root, ["commit", "-q", "-m", "features"]);
  for (let i = 0; i < worktrees; i++) {
    const id = `${String(i + 1).padStart(3, "0")}-feature-${i + 1}`;
    const path = join(root, ".worktrees", id);
    gitRun(root, ["worktree", "add", "-q", "-b", id, path, "main"]);
    const tasks = join(path, "specs", id, "tasks.md");
    writeFileSync(tasks, readFileSync(tasks, "utf8").replace("- [ ]", "- [x]"));
  }
  return root;
}

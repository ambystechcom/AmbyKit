import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitProject, gitRun } from "./git-repo.js";

/**
 * A project with feature worktrees (feature 017 fixture). Each feature gets a one-story spec and a
 * `tasks.md` of `total` open tasks on main; `worktrees` are added under `.worktrees/<id>` with real
 * `git worktree add`, exactly as `ambykit worktree` lays them out.
 */
export function spec(id: string): string {
  return `---\nfeature: ${id}\nstatus: draft\n---\n# ${id}\n\n### US-1 — Story one  (priority: P1)\n\n- **status:** in-progress\n`;
}

export function tasks(total: number, done = 0): string {
  const lines = Array.from({ length: total }, (_, i) => {
    const id = `T${String(i + 1).padStart(3, "0")}`;
    return `- [${i < done ? "x" : " "}] [${id}] [US1] task ${i + 1} (src/x.ts)`;
  });
  return `# Tasks\n\n${lines.join("\n")}\n`;
}

export function writeFeature(root: string, id: string, total: number, done = 0): void {
  mkdirSync(join(root, "specs", id), { recursive: true });
  writeFileSync(join(root, "specs", id, "spec.md"), spec(id));
  writeFileSync(join(root, "specs", id, "tasks.md"), tasks(total, done));
}

export function worktreeProject(features: string[], worktrees: string[] = [], total = 10): string {
  const root = gitProject([]);
  for (const id of features) writeFeature(root, id, total);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\n");
  gitRun(root, ["add", "-A"]);
  gitRun(root, ["commit", "-q", "-m", "features"]);
  for (const id of worktrees) addWorktree(root, id);
  return root;
}

export function addWorktree(root: string, id: string): string {
  const path = join(root, ".worktrees", id);
  gitRun(root, ["worktree", "add", "-q", "-b", id, path, "main"]);
  return path;
}

/** Tick the first `done` tasks of a feature inside `checkoutRoot` (main or a worktree). */
export function tick(checkoutRoot: string, id: string, done: number, total = 10): void {
  writeFileSync(join(checkoutRoot, "specs", id, "tasks.md"), tasks(total, done));
}

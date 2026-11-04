import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitProject, gitRun } from "./git-repo.js";
import { addWorktree } from "./worktree-fixture.js";

/**
 * A project ready for lanes (feature 015 fixture): `.amby/config.json` has `worktrees: true`, the
 * feature's `tasks.md` is committed on `main`, and the feature has its own branch + worktree at
 * `.worktrees/<feature>` (exactly as `ambykit worktree` lays it out). Lanes are then added under
 * `.worktrees/<feature>.lane-<phase>-<k>` branching from the feature branch.
 */

export interface LaneProject {
  /** Main checkout root. */
  root: string;
  feature: string;
  /** Feature worktree root (`.worktrees/<feature>`). */
  featureRoot: string;
}

export function laneProject(
  feature: string,
  tasksBody: string,
  opts: { worktrees?: boolean } = {},
): LaneProject {
  const root = gitProject([feature]);
  gitRun(root, ["config", "core.autocrlf", "false"]); // byte-exact files: CRLF cases must survive checkout
  const config = { version: "0.0.0", tools: ["claude"], worktrees: opts.worktrees ?? true };
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify(config) + "\n");
  writeFileSync(join(root, "specs", feature, "tasks.md"), tasksBody);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\n");
  gitRun(root, ["add", "-A"]);
  gitRun(root, ["commit", "-q", "-m", "lane fixture"]);
  const featureRoot = addWorktree(root, feature);
  return { root, feature, featureRoot };
}

/** Add a lane worktree + branch off the feature branch; returns its path. */
export function addLane(p: LaneProject, phase: number, index: number): string {
  const name = `${p.feature}.lane-${phase}-${index}`;
  const path = join(p.root, ".worktrees", name);
  gitRun(p.root, ["worktree", "add", "-q", "-b", name, path, p.feature]);
  return path;
}

/** Write a file inside a checkout (creating parent dirs) and commit it there. */
export function commitFile(checkout: string, rel: string, content: string, message = `edit ${rel}`): void {
  const full = join(checkout, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
  gitRun(checkout, ["add", "-A"]);
  gitRun(checkout, ["commit", "-q", "-m", message]);
}

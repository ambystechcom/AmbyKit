import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { GitWorktree } from "./git.js";

/** Directory (relative to the project root) that holds per-feature worktrees (FR-002). */
export const WORKTREES_DIR = ".worktrees";

const FEATURE_ID = /^\d{3}-[a-z0-9][a-z0-9-]*$/;

/** Feature ids = names of `specs/NNN-slug/` directories, sorted. */
export function featureIds(root: string): string[] {
  const dir = join(root, "specs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => FEATURE_ID.test(n) && statSync(join(dir, n)).isDirectory())
    .sort();
}

/** Absolute path of the worktree for `featureId` (FR-002). */
export function worktreePath(root: string, featureId: string): string {
  return join(root, WORKTREES_DIR, featureId);
}

/** Add an ignore rule for `.worktrees/` to gitignore text if absent; returns the new text. */
export function ensureGitignore(text: string): { text: string; changed: boolean } {
  const rule = `${WORKTREES_DIR}/`;
  const has = text.split(/\r?\n/).some((l) => {
    const t = l.trim();
    return t === rule || t === WORKTREES_DIR || t === `/${rule}` || t === `/${WORKTREES_DIR}`;
  });
  if (has) return { text, changed: false };
  const sep = text.length === 0 || text.endsWith("\n") ? "" : "\n";
  return { text: `${text}${sep}# AmbyKit per-feature worktrees\n${rule}\n`, changed: true };
}

/** Normalize a path for comparison against git's forward-slash output. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => resolve(p).replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/** The registered worktree whose path is `.worktrees/<featureId>`, if any. */
export function findWorktree(root: string, featureId: string, list: GitWorktree[]): GitWorktree | undefined {
  const want = worktreePath(root, featureId);
  return list.find((w) => samePath(w.path, want));
}

/** Feature id when `dir` is (inside) a `.worktrees/<id>` directory of some project, else null. */
export function featureFromWorktreePath(dir: string): string | null {
  const parts = resolve(dir).split(sep);
  const i = parts.lastIndexOf(WORKTREES_DIR);
  if (i === -1 || i + 1 >= parts.length) return null;
  const id = parts[i + 1] ?? "";
  return FEATURE_ID.test(id) ? id : null;
}

export type CreatePlan =
  | { action: "exists"; path: string }
  | { action: "create"; path: string; branch: string; newBranch: boolean; base: string | null }
  | { action: "refuse"; reason: string };

/**
 * Decide what creating a worktree for `featureId` should do (FR-003/004/005 + edge cases). Pure:
 * takes facts, returns a plan; the CLI performs it.
 */
export function planCreate(input: {
  root: string;
  featureId: string;
  features: string[];
  worktrees: GitWorktree[];
  branchExists: boolean;
  defaultBranch: string | null;
  dirExists: boolean;
}): CreatePlan {
  const { root, featureId, features } = input;
  if (!features.includes(featureId)) {
    const list = features.length ? features.join(", ") : "(none — run /amby.specify first)";
    return { action: "refuse", reason: `No feature '${featureId}' under specs/. Valid: ${list}` };
  }
  const path = worktreePath(root, featureId);
  const existing = findWorktree(root, featureId, input.worktrees);
  if (existing) return { action: "exists", path: existing.path };
  if (input.dirExists) {
    return { action: "refuse", reason: `${path} exists but is not a registered worktree — remove it (or run \`git worktree prune\`) and retry.` };
  }
  const elsewhere = input.worktrees.find((w) => w.branch === featureId);
  if (elsewhere) {
    return { action: "refuse", reason: `Branch '${featureId}' is already checked out at ${elsewhere.path}.` };
  }
  if (!input.branchExists && !input.defaultBranch) {
    return { action: "refuse", reason: "Cannot determine the default branch (no origin/HEAD, main, or master)." };
  }
  return {
    action: "create",
    path,
    branch: featureId,
    newBranch: !input.branchExists,
    base: input.branchExists ? null : input.defaultBranch,
  };
}

export type RemovePlan =
  | { action: "absent" }
  | { action: "refuse"; reason: string; path: string }
  | { action: "remove"; path: string; force: boolean };

export function planRemove(input: {
  root: string;
  featureId: string;
  worktrees: GitWorktree[];
  dirty: boolean;
  force: boolean;
}): RemovePlan {
  const existing = findWorktree(input.root, input.featureId, input.worktrees);
  if (!existing) return { action: "absent" };
  if (input.dirty && !input.force) {
    return { action: "refuse", path: existing.path, reason: "has uncommitted changes — commit them or pass --force." };
  }
  return { action: "remove", path: existing.path, force: input.force };
}

export interface WorktreeStatus {
  feature: string;
  branch: string | null;
  path: string;
  dirty: boolean;
  stale: boolean;
}

/** Worktrees under `.worktrees/`, matched to feature ids (unknown dirs keep their dir name). */
export function featureWorktrees(root: string, list: GitWorktree[]): { feature: string; worktree: GitWorktree }[] {
  const base = resolve(root, WORKTREES_DIR);
  return list
    .filter((w) => samePath(resolve(w.path, ".."), base))
    .map((w) => ({ feature: featureFromWorktreePath(w.path) ?? (w.path.split(/[\\/]/).pop() ?? w.path), worktree: w }));
}

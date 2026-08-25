import { execFileSync } from "node:child_process";

/**
 * Thin wrappers over the `git` CLI (feature 012). Every call is synchronous and scoped to one
 * repository via `cwd`. Failures surface as `Error` with git's stderr so callers can decide what to
 * show; nothing here prints.
 */

export interface GitWorktree {
  /** Absolute path as reported by git (forward slashes on Windows). */
  path: string;
  /** Branch name without `refs/heads/`, or null when detached. */
  branch: string | null;
  head: string;
}

/** Run git in `cwd` and return trimmed stdout. Throws with stderr on non-zero exit. */
export function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error((e.stderr ?? e.message).trim());
  }
}

/** Whether `git` is available on PATH. */
export function gitAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Whether `dir` is inside a git working tree. */
export function isRepo(dir: string): boolean {
  try {
    return git(dir, ["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function branchExists(cwd: string, branch: string): boolean {
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/** Current branch name, or null when detached. */
export function currentBranch(cwd: string): string | null {
  try {
    const name = git(cwd, ["symbolic-ref", "--short", "-q", "HEAD"]);
    return name || null;
  } catch {
    return null;
  }
}

/**
 * The repository's default branch (FR-003): what the remote advertises as HEAD, else the first of
 * `main`/`master` that exists locally, else null.
 */
export function defaultBranch(cwd: string): string | null {
  try {
    const ref = git(cwd, ["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"]);
    if (ref) return ref.replace(/^origin\//, "");
  } catch {
    /* no remote HEAD */
  }
  for (const b of ["main", "master"]) if (branchExists(cwd, b)) return b;
  return null;
}

/** Parse `git worktree list --porcelain` output. Exported for unit tests. */
export function parseWorktreeList(porcelain: string): GitWorktree[] {
  const out: GitWorktree[] = [];
  let cur: Partial<GitWorktree> | null = null;
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (cur?.path) out.push({ path: cur.path, branch: cur.branch ?? null, head: cur.head ?? "" });
      cur = { path: line.slice("worktree ".length) };
    } else if (cur && line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
  }
  if (cur?.path) out.push({ path: cur.path, branch: cur.branch ?? null, head: cur.head ?? "" });
  return out;
}

export function worktreeList(cwd: string): GitWorktree[] {
  return parseWorktreeList(git(cwd, ["worktree", "list", "--porcelain"]));
}

/** Uncommitted changes (staged, unstaged, or untracked) in `dir`. */
export function isDirty(dir: string): boolean {
  return git(dir, ["status", "--porcelain"]).length > 0;
}

/** Whether `branch` is an ancestor of `base` (i.e. fully merged). */
export function isMerged(cwd: string, branch: string, base: string): boolean {
  try {
    git(cwd, ["merge-base", "--is-ancestor", branch, base]);
    return true;
  } catch {
    return false;
  }
}

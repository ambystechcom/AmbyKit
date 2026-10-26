import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { compareFeatureDirs, assignDisplayRefs, readFeatures } from "./features.js";
import { defaultBranch, git, isDirty, isRepo, worktreeList } from "./git.js";
import type { Checkout, FeatureSnapshot, ParseIssue } from "./overview-types.js";
import { WORKTREES_DIR, featureWorktrees } from "./worktree.js";

/**
 * Worktree-aware feature reading (feature 017, US-1). The dashboard sees the primary checkout plus
 * every feature worktree under `.worktrees/`, whichever checkout it runs from (FR-001). `mergeCheckouts`
 * is pure; `resolveCheckouts`/`readProjectFeatures` are the thin IO edges around it.
 */

/** A feature worktree and the feature it isolates. */
export interface FeatureCheckout {
  feature: string;
  checkout: Checkout;
}

export interface ProjectCheckouts {
  primary: Checkout;
  worktrees: FeatureCheckout[];
}

/** The primary checkout's root: `root` itself, or the project that holds the `.worktrees/<id>` it is in. */
export function primaryRoot(root: string): string {
  const parts = resolve(root).split(sep);
  const i = parts.lastIndexOf(WORKTREES_DIR);
  return i > 0 ? parts.slice(0, i).join(sep) || sep : resolve(root);
}

/**
 * Resolve the primary checkout and its feature worktrees. Git state costs one `status` per worktree
 * plus one `branch --merged` in total, keeping the one-shot view inside its 1 s budget (SC-003).
 * Not a git repository, or git failing ⇒ the primary checkout alone (FR-008).
 */
export function resolveCheckouts(root: string): ProjectCheckouts {
  const primary: Checkout = { root: primaryRoot(root), kind: "main" };
  if (!isRepo(primary.root)) return { primary, worktrees: [] };
  let found: ReturnType<typeof featureWorktrees>;
  try {
    found = featureWorktrees(primary.root, worktreeList(primary.root));
  } catch {
    return { primary, worktrees: [] };
  }
  if (found.length === 0) return { primary, worktrees: [] };

  const base = defaultBranch(primary.root);
  const merged = new Set<string>();
  let baseHead = "";
  if (base) {
    try {
      baseHead = git(primary.root, ["rev-parse", base]);
      for (const b of git(primary.root, ["branch", "--merged", base, "--format=%(refname:short)"]).split("\n")) {
        if (b.trim()) merged.add(b.trim());
      }
    } catch {
      /* stale stays false */
    }
  }

  const worktrees = found.map(({ feature, worktree }): FeatureCheckout => {
    const checkout: Checkout = { root: resolve(worktree.path), kind: "worktree" };
    if (worktree.branch) checkout.branch = worktree.branch;
    let dirty = false;
    try {
      dirty = existsSync(worktree.path) && isDirty(worktree.path);
    } catch {
      /* unreadable: reported by readProjectFeatures */
    }
    checkout.dirty = dirty;
    // A fresh worktree's branch is trivially "merged" (it *is* the base); only count it as stale once
    // the base has moved past it, i.e. its work landed and the worktree lingers.
    checkout.stale = !!(
      base &&
      worktree.branch &&
      worktree.branch !== base &&
      merged.has(worktree.branch) &&
      worktree.head !== baseHead
    );
    return { feature, checkout };
  });
  return { primary, worktrees };
}

/**
 * Merge per-checkout snapshots (FR-002/003/004): a worktree contributes **only its own feature dir**,
 * which replaces the primary copy or is added; copies of other features inside a worktree are stale
 * and ignored. Re-sorted by number and given unique display refs, as `readFeatures` does.
 */
export function mergeCheckouts(
  primary: FeatureSnapshot[],
  worktrees: { feature: string; checkout: Checkout; features: FeatureSnapshot[] }[],
): FeatureSnapshot[] {
  const byDir = new Map(primary.map((f) => [f.dir, f]));
  for (const wt of worktrees) {
    const own = wt.features.find((f) => f.dir === wt.feature);
    if (own) byDir.set(own.dir, { ...own, checkout: wt.checkout });
  }
  const merged = [...byDir.values()].sort((a, b) => compareFeatureDirs(a.dir, b.dir));
  assignDisplayRefs(merged);
  return merged;
}

export interface ProjectFeatures {
  features: FeatureSnapshot[];
  issues: ParseIssue[];
  checkouts: ProjectCheckouts;
}

/** Read the whole project across checkouts. An unreadable worktree becomes a `ParseIssue` (FR-009). */
export function readProjectFeatures(root: string, checkouts: ProjectCheckouts = resolveCheckouts(root)): ProjectFeatures {
  const main = readFeatures(checkouts.primary.root);
  const issues = [...main.issues];
  const worktrees: { feature: string; checkout: Checkout; features: FeatureSnapshot[] }[] = [];
  for (const wt of checkouts.worktrees) {
    const label = `${WORKTREES_DIR}/${wt.feature}`;
    if (!existsSync(join(wt.checkout.root, "specs"))) {
      if (!existsSync(wt.checkout.root)) issues.push({ file: label, reason: "worktree directory is missing" });
      continue;
    }
    try {
      const read = readFeatures(wt.checkout.root, { only: wt.feature });
      for (const i of read.issues) issues.push({ file: `${label}/${i.file}`, reason: i.reason });
      worktrees.push({ ...wt, features: read.features });
    } catch (err) {
      issues.push({ file: label, reason: (err as Error).message.split("\n")[0] ?? "unreadable" });
    }
  }
  return { features: mergeCheckouts(main.features, worktrees), issues, checkouts };
}

/** Every checkout root, primary first (for watchers and agent attribution). */
export function allCheckouts(c: ProjectCheckouts): Checkout[] {
  return [c.primary, ...c.worktrees.map((w) => w.checkout)];
}

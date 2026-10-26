import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { compareFeatureDirs, assignDisplayRefs, readFeatures } from "./features.js";
import { gitAsync, parseWorktreeList } from "./git.js";
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
 * The default branch, as `defaultBranch` resolves it (origin's HEAD, else `main`, else `master`),
 * with the fallbacks probed side by side.
 */
async function baseBranch(cwd: string): Promise<string | null> {
  try {
    const ref = await gitAsync(cwd, ["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"]);
    if (ref) return ref.replace(/^origin\//, "");
  } catch {
    /* no remote HEAD */
  }
  const exists = (b: string) => gitAsync(cwd, ["rev-parse", "--verify", "-q", `refs/heads/${b}`]).then(() => true, () => false);
  const [main, master] = await Promise.all([exists("main"), exists("master")]);
  return main ? "main" : master ? "master" : null;
}

/** Branches merged into `base`, with their commits; `base` itself is among them. */
async function mergedInto(cwd: string, base: string): Promise<Map<string, string>> {
  const out = await gitAsync(cwd, ["branch", "--merged", base, "--format=%(refname:short) %(objectname)"]);
  const merged = new Map<string, string>();
  for (const line of out.split("\n")) {
    const [name, sha] = line.trim().split(" ");
    if (name && sha) merged.set(name, sha);
  }
  return merged;
}

/**
 * Resolve the primary checkout and its feature worktrees. Git state costs one `status` per worktree
 * plus one `branch --merged` in total, and those run concurrently: process startup dominates on
 * Windows, and running them one by one broke the one-shot 1 s budget (SC-003).
 * Not a git repository, or git failing ⇒ the primary checkout alone (FR-008).
 */
export async function resolveCheckouts(root: string): Promise<ProjectCheckouts> {
  const primary: Checkout = { root: primaryRoot(root), kind: "main" };
  let found: ReturnType<typeof featureWorktrees>;
  try {
    found = featureWorktrees(primary.root, parseWorktreeList(await gitAsync(primary.root, ["worktree", "list", "--porcelain"])));
  } catch {
    return { primary, worktrees: [] }; // not a repository
  }
  if (found.length === 0) return { primary, worktrees: [] };

  const mergedState = baseBranch(primary.root).then(async (base) => {
    if (!base) return { base, merged: new Map<string, string>() };
    return { base, merged: await mergedInto(primary.root, base).catch(() => new Map<string, string>()) };
  });
  const dirtyStates = found.map(({ worktree }) =>
    existsSync(worktree.path)
      ? gitAsync(worktree.path, ["status", "--porcelain"]).then((s) => s.length > 0, () => false) // unreadable: reported by readProjectFeatures
      : Promise.resolve(false),
  );
  const [{ base, merged }, dirty] = await Promise.all([mergedState, Promise.all(dirtyStates)]);
  const baseHead = base ? merged.get(base) : undefined;

  const worktrees = found.map(({ feature, worktree }, i): FeatureCheckout => {
    const checkout: Checkout = { root: resolve(worktree.path), kind: "worktree" };
    if (worktree.branch) checkout.branch = worktree.branch;
    checkout.dirty = dirty[i]!;
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
export async function readProjectFeatures(root: string, given?: ProjectCheckouts): Promise<ProjectFeatures> {
  const checkouts = given ?? (await resolveCheckouts(root));
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

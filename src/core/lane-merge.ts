import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchExists, git, gitWithInput, isDirty, isMerged, worktreeList } from "./git.js";
import { matchLane, mergeCheckoffs } from "./lanes.js";
import { findWorktree, laneWorktrees } from "./worktree.js";

/**
 * The check-off-aware lane merge (feature 015 FR-019), extracted from `ambykit lane merge` so that command
 * and `ambykit run` (feature 028, FR-011) share one implementation. Lanes are merged one at a time in name
 * order. A `tasks.md` conflict that is only about check-offs is resolved; any other conflict aborts that
 * merge, leaves the lane intact and is reported (FR-012). Git side effects only; no output.
 */

export type LaneMergeKind = "merged" | "nothing" | "dirty" | "conflict";

export interface LaneMergeResult {
  lane: string;
  result: LaneMergeKind;
  detail?: string;
}

export type MergeLanesOutcome =
  | { ok: true; lanes: LaneMergeResult[]; /** Lanes asked for that exist; empty means the feature has none. */ found: number }
  | { ok: false; kind: "not-checked-out" | "dirty-checkout" | "no-lane"; error: string; /** The checkout, for `dirty-checkout`. */ path?: string };

/** The feature's branch and (when checked out somewhere) the checkout holding it. */
export function featureBranch(root: string, feature: string): { branch: string; checkout: string | null } | null {
  const worktrees = worktreeList(root);
  const wt = findWorktree(root, feature, worktrees);
  if (wt?.branch) return { branch: wt.branch, checkout: wt.path };
  if (!branchExists(root, feature)) return null;
  const holder = worktrees.find((w) => w.branch === feature);
  return { branch: feature, checkout: holder?.path ?? null };
}

function hasMergeHead(cwd: string): boolean {
  try {
    git(cwd, ["rev-parse", "-q", "--verify", "MERGE_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function abortMerge(cwd: string): void {
  try {
    git(cwd, ["merge", "--abort"]);
  } catch {
    /* nothing to abort */
  }
}

/** Auto-resolve a tasks.md conflict that is only about check-offs. False when it is more than that. */
function resolveCheckoffs(checkout: string, tasksRel: string): boolean {
  const stage = (n: number): string => {
    try {
      return gitWithInput(checkout, ["show", `:${n}:${tasksRel}`], "").toString("utf8");
    } catch {
      return "";
    }
  };
  const merged = mergeCheckoffs(stage(1), stage(2), stage(3));
  if (merged === null) return false;
  writeFileSync(join(checkout, tasksRel), merged, "utf8");
  git(checkout, ["add", tasksRel]);
  return true;
}

/** Merge a feature's lanes (all, or the one `laneArg` names) into its checkout. */
export function mergeLanes(root: string, feature: string, laneArg?: string): MergeLanesOutcome {
  const worktrees = worktreeList(root);
  const fb = featureBranch(root, feature);
  if (!fb || !fb.checkout) {
    return { ok: false, kind: "not-checked-out", error: `${feature} is not checked out anywhere — check out its branch (or \`ambykit worktree ${feature}\`) first.` };
  }
  const checkout = fb.checkout;
  if (isDirty(checkout)) {
    return { ok: false, kind: "dirty-checkout", path: checkout, error: `${checkout} has uncommitted changes — commit or stash them before merging lanes.` };
  }
  const all = laneWorktrees(root, worktrees)
    .filter((l) => l.feature === feature)
    .sort((a, b) => a.name.localeCompare(b.name));
  let lanes = all;
  if (laneArg) {
    const name = matchLane(feature, all.map((l) => l.name), laneArg);
    if (!name) return { ok: false, kind: "no-lane", error: `No lane '${laneArg}' for ${feature}. Lanes: ${all.map((l) => l.name).join(", ") || "(none)"}` };
    lanes = all.filter((l) => l.name === name);
  }

  const tasksRel = `specs/${feature}/tasks.md`;
  const report: LaneMergeResult[] = [];
  for (const l of lanes) {
    if (existsSync(l.worktree.path) && isDirty(l.worktree.path)) {
      report.push({ lane: l.name, result: "dirty", detail: "has uncommitted changes — commit first" });
      continue;
    }
    if (isMerged(root, l.name, fb.branch)) {
      report.push({ lane: l.name, result: "nothing" });
      continue;
    }
    try {
      git(checkout, ["merge", "--no-ff", "--no-commit", l.name]);
    } catch {
      const unmerged = git(checkout, ["diff", "--name-only", "--diff-filter=U"]).split(/\r?\n/).filter(Boolean);
      const resolved = unmerged.length === 1 && unmerged[0] === tasksRel ? resolveCheckoffs(checkout, tasksRel) : false;
      if (!resolved) {
        abortMerge(checkout);
        report.push({
          lane: l.name,
          result: "conflict",
          detail: unmerged.length > 0 ? `conflicts in ${unmerged.join(", ")} — merge it by hand` : "merge failed",
        });
        continue;
      }
    }
    if (hasMergeHead(checkout)) git(checkout, ["commit", "-q", "-m", `Merge lane ${l.name}`]);
    report.push({ lane: l.name, result: "merged" });
  }
  return { ok: true, lanes: report, found: lanes.length };
}

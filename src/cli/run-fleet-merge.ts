import { featureBranch } from "../core/lane-merge.js";
import { git, isDirty, isMerged } from "../core/git.js";
import { laneRefs } from "../core/query.js";

/**
 * Before a dependent feature starts (feature 031, FR-004, FR-007, D2), the feature it waits for is merged into
 * its branch, so it builds on the merged result; "merged" means that feature's lanes are merged into its own
 * branch (clarification C-1), never into `main`. A real conflict aborts that merge, leaves everything as it was
 * and pauses only the dependent feature (FR-013): it is never auto-resolved (risk R2).
 */

export type MergeStep = { ok: true; merged: string[] } | { ok: false; on: string; reason: string; files: string[] };

function conflictFiles(cwd: string): string[] {
  try {
    return git(cwd, ["diff", "--name-only", "--diff-filter=U"]).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/** `git merge --no-edit <from>` in `cwd`. A conflict is aborted and reported with its files. */
function mergeInto(cwd: string, from: string): { ok: true } | { ok: false; files: string[]; detail: string } {
  try {
    git(cwd, ["merge", "--no-edit", from]);
    return { ok: true };
  } catch (err) {
    const files = conflictFiles(cwd);
    try {
      git(cwd, ["merge", "--abort"]);
    } catch {
      /* nothing to abort */
    }
    return { ok: false, files, detail: (err as Error).message.split("\n")[0] ?? "merge failed" };
  }
}

/** Merge each finished feature in `on` into `feature`'s branch, in order. Stops at the first failure. */
export function mergeDependencies(root: string, feature: string, on: readonly string[]): MergeStep {
  const target = featureBranch(root, feature);
  if (!target?.checkout) return { ok: false, on: on[0] ?? "", reason: `${feature} is not checked out anywhere; create its worktree with \`ambykit worktree ${feature}\``, files: [] };
  if (isDirty(target.checkout)) return { ok: false, on: on[0] ?? "", reason: `${target.checkout} has uncommitted changes; commit them first`, files: [] };
  const merged: string[] = [];
  for (const dep of on) {
    const from = featureBranch(root, dep);
    if (!from) return { ok: false, on: dep, reason: `${dep} has no branch to merge`, files: [] };
    if (isMerged(root, from.branch, target.branch)) continue; // already in
    const r = mergeInto(target.checkout, from.branch);
    if (!r.ok) return { ok: false, on: dep, reason: `merging ${dep} into ${feature} conflicts${r.files.length ? ` in ${r.files.join(", ")}` : ""}; resolve it by hand, then continue the fleet`, files: r.files };
    merged.push(dep);
  }
  return { ok: true, merged };
}

/**
 * Prepared lanes branched from the feature before a dependency was merged into it: bring each lane up to the
 * feature branch so its worker sees the dependency's work. Only the lanes' own checkouts change.
 */
export function syncLanesWithFeature(root: string, feature: string): MergeStep {
  const target = featureBranch(root, feature);
  if (!target) return { ok: true, merged: [] };
  const merged: string[] = [];
  for (const lane of laneRefs(root, feature)) {
    if (isDirty(lane.root) || isMerged(root, target.branch, lane.name)) continue;
    const r = mergeInto(lane.root, target.branch);
    if (!r.ok) return { ok: false, on: feature, reason: `bringing ${lane.name} up to ${feature} conflicts${r.files.length ? ` in ${r.files.join(", ")}` : ""}`, files: r.files };
    merged.push(lane.name);
  }
  return { ok: true, merged };
}

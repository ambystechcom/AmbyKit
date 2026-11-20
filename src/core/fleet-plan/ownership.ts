import { overlaps } from "../lanes.js";
import type { FeatureModel, Ownership } from "./types.js";

/**
 * File ownership of a feature (feature 031, FR-004..FR-006). The set is the union of the declared paths of its
 * open tasks, from the model the 030 reader gives (so 1.x trailing groups and 2.x `files` blocks agree). An open
 * task with no usable ownership (`missing`, or a glob that cannot be compared) is listed in `unknown`: the feature
 * is then treated as owning everything it could touch (conservative; never assumed independent).
 */
export function ownershipOf(feature: Pick<FeatureModel, "tasks">): Ownership {
  const files = new Set<string>();
  const unknown: string[] = [];
  for (const t of feature.tasks) {
    if (t.done) continue;
    if (t.pathIssue || t.paths.length === 0) {
      unknown.push(t.id);
      continue;
    }
    for (const p of t.paths) files.add(p);
  }
  return { files: [...files].sort(), unknown };
}

/** The paths of `a` that overlap a path of `b` (either side's path, so a directory covers its files). Sorted, unique. */
export function sharedFiles(a: Ownership, b: Ownership): string[] {
  const out = new Set<string>();
  for (const x of a.files) for (const y of b.files) if (overlaps(x, y)) out.add(x.length >= y.length ? x : y);
  return [...out].sort();
}

/** Two features conflict when they share a file, or either one's ownership is unknown. */
export function conflicts(a: Ownership, b: Ownership): boolean {
  return a.unknown.length > 0 || b.unknown.length > 0 || sharedFiles(a, b).length > 0;
}

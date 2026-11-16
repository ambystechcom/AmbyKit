import { buildMatrix } from "./trace.js";
import { readTraceSources, type TraceSources } from "./trace-io.js";
import type { FeatureSnapshot } from "./overview-types.js";

/**
 * Attach each feature's requirement coverage to its snapshot (feature 024, FR-012). One scan per
 * checkout (the primary root, and each worktree root for features read from a worktree), so the
 * dashboard pays for one test walk per checkout, not per feature. Absent when a feature has no
 * requirements, so existing output is unchanged. Never throws: a failed scan leaves features as they were.
 */
export function attachCoverage(features: FeatureSnapshot[], primaryRoot: string): void {
  const sources = new Map<string, TraceSources | null>();
  const sourcesOf = (root: string): TraceSources | null => {
    if (!sources.has(root)) {
      try {
        sources.set(root, readTraceSources(root));
      } catch {
        sources.set(root, null);
      }
    }
    return sources.get(root) ?? null;
  };
  const reports = new Map<string, ReturnType<typeof buildMatrix>>();
  for (const f of features) {
    const root = f.checkout?.kind === "worktree" ? f.checkout.root : primaryRoot;
    const src = sourcesOf(root);
    if (!src) continue;
    if (!reports.has(root)) reports.set(root, buildMatrix({ features: src.features, tests: src.tests }));
    const t = reports.get(root)!.features.find((x) => x.feature === f.dir);
    if (!t || t.coverage.total === 0) continue;
    f.coverage = {
      covered: t.coverage.covered,
      total: t.coverage.total,
      uncovered: t.requirements.filter((r) => r.status === "uncovered").map((r) => ({ id: r.id, text: r.text })),
    };
  }
}

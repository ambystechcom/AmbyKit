import type { FeatureModel, PlanError, Skipped } from "./types.js";

/**
 * Which features a fleet runs (feature 031, FR-001..FR-003, FR-016). Pure. Named features are resolved by number,
 * directory name or reference, de-duplicated (a feature listed twice is scheduled once), and each must be ready:
 * the spec approved (`ready` or `in-progress`), a plan and a task list present, and work left to do. `--all-ready`
 * selects every ready feature and reports the skipped ones with the reason (features already done are not listed:
 * they are finished, not skipped).
 */

export interface SelectResult {
  selected: FeatureModel[];
  errors: PlanError[];
  skipped: Skipped[];
}

const APPROVED = new Set(["ready", "in-progress"]);

/** Why a feature cannot run now, or null when it is ready. */
export function notReadyReason(m: FeatureModel): string | null {
  if (!m.artifacts.spec) return "no spec.md";
  if (!APPROVED.has(m.status)) return `spec status is '${m.status || "unset"}' (needs 'ready' or 'in-progress')`;
  if (!m.artifacts.plan) return "no plan.md";
  if (!m.artifacts.tasks) return "no tasks.md";
  if (m.tasks.length === 0) return "tasks.md has no tasks";
  if (m.tasks.every((t) => t.done)) return "every task is already checked off";
  return null;
}

function resolve(arg: string, models: readonly FeatureModel[]): FeatureModel | undefined {
  const byName = models.find((m) => m.dir === arg);
  if (byName) return byName;
  if (/^\d+$/.test(arg)) return models.find((m) => Number(m.ref) === Number(arg));
  return models.find((m) => m.ref === arg);
}

export function selectFeatures(args: readonly string[], models: readonly FeatureModel[], opts: { allReady?: boolean } = {}): SelectResult {
  const errors: PlanError[] = [];
  const skipped: Skipped[] = [];
  const selected: FeatureModel[] = [];

  if (opts.allReady) {
    for (const m of models) {
      const why = notReadyReason(m);
      if (why === null) selected.push(m);
      else if (!(m.tasks.length > 0 && m.tasks.every((t) => t.done)) && m.status !== "done") skipped.push({ feature: m.dir, reason: why });
    }
    if (selected.length === 0) errors.push({ kind: "no-features", message: "No feature is ready to run, so nothing was started." });
    return { selected, errors, skipped };
  }

  const seen = new Set<string>();
  for (const arg of args) {
    const m = resolve(arg, models);
    if (!m) {
      errors.push({ kind: "not-found", feature: arg, message: `Feature '${arg}' not found. Use a feature number or directory name from specs/.` });
      continue;
    }
    if (seen.has(m.dir)) continue;
    seen.add(m.dir);
    const why = notReadyReason(m);
    if (why !== null) {
      errors.push({ kind: "not-ready", feature: m.dir, message: `${m.dir} is not ready to run: ${why}.` });
      continue;
    }
    selected.push(m);
  }
  if (selected.length === 0 && errors.length === 0) errors.push({ kind: "no-features", message: "No features given." });
  return { selected, errors, skipped };
}

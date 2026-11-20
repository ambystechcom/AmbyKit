import { createHash } from "node:crypto";
import { orderFleet } from "./order.js";
import { ownershipOf } from "./ownership.js";
import { selectFeatures } from "./select.js";
import type { DepEdge, FeatureModel, FleetBudgets, FleetCaps, FleetFeature, FleetPlan, Planned } from "./types.js";

/**
 * One fleet plan (feature 031, FR-001..FR-008, FR-016): select, ownership, order and caps. Pure: it gets the
 * project's models and edges from `read.ts` and returns what the preview prints and `fleet.json` stores.
 */

export interface PlanInput {
  /** Feature numbers or names as given; ignored with `allReady`. */
  args: readonly string[];
  allReady?: boolean;
  models: readonly FeatureModel[];
  deps: readonly DepEdge[];
  done: ReadonlySet<string>;
  caps: FleetCaps;
  budgets: FleetBudgets;
  /** Lanes the fleet prepares for a feature that has none (clarification C-2). */
  lanesToPrepare?: number;
}

/**
 * What the plan was made from, not how far the work has got: task ids, their declared paths and ownership issues,
 * and the feature's dependency edges. Ticking a task does not change it; editing a task list or a dependency does.
 */
export function fingerprintOf(m: FeatureModel, deps: readonly DepEdge[]): string {
  const body = JSON.stringify({
    tasks: m.tasks.map((t) => [t.id, t.phase, t.parallel, t.paths, t.pathIssue ?? ""]),
    deps: deps.filter((d) => d.feature === m.dir).map((d) => `${d.on}:${d.why}`).sort(),
  });
  return createHash("sha1").update(body).digest("hex").slice(0, 12);
}

export function buildFleetPlan(input: PlanInput): Planned<FleetPlan> {
  const picked = selectFeatures(input.args, input.models, { ...(input.allReady ? { allReady: true } : {}) });
  if (picked.errors.length > 0) return { ok: false, errors: picked.errors };

  const ownership = new Map(picked.selected.map((m) => [m.dir, ownershipOf(m)]));
  const ordered = orderFleet({
    features: picked.selected.map((m) => ({ feature: m.dir, ownership: ownership.get(m.dir)! })),
    deps: [...input.deps],
    done: input.done,
  });
  if (!ordered.ok) return ordered;

  const byDir = new Map(picked.selected.map((m) => [m.dir, m]));
  const features: FleetFeature[] = ordered.value.order.map((dir) => ({
    feature: dir,
    state: "waiting",
    waitsFor: ordered.value.waitsFor.get(dir) ?? [],
    ownership: ownership.get(dir)!,
    fingerprint: fingerprintOf(byDir.get(dir)!, input.deps),
  }));
  const laneCounts = Object.fromEntries(picked.selected.map((m) => [m.dir, m.lanes]));
  const prepare = picked.selected.filter((m) => m.lanes === 0).map((m) => ({ feature: m.dir, lanes: input.lanesToPrepare ?? 2 }));
  return { ok: true, value: { features, caps: input.caps, budgets: input.budgets, skipped: picked.skipped, prepare, laneCounts } };
}

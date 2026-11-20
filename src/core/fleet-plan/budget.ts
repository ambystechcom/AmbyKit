import { budgetDecision, type BudgetDecision, type Budgets } from "../run-supervise.js";

/**
 * Fleet-wide budgets (feature 031, FR-011). Pure. Spec 028's `budgetDecision` is reused unchanged on the fleet's
 * totals: task events and tokens are summed over the features' meters; wall-clock is the fleet's own elapsed
 * time (features run side by side, so the longest meter, not the sum). A token ceiling is enforced only where
 * every runner in the fleet reports usage, and the decision says so when it cannot be (028's rule).
 */

export interface FeatureMeter {
  elapsedMs: number;
  tasksUsed: number;
  tokensUsed?: number;
}

export function fleetTotals(meters: readonly FeatureMeter[]): { elapsedMs: number; tasksUsed: number; tokensUsed?: number } {
  const reported = meters.filter((m) => m.tokensUsed !== undefined);
  return {
    elapsedMs: Math.max(0, ...meters.map((m) => m.elapsedMs)),
    tasksUsed: meters.reduce((n, m) => n + m.tasksUsed, 0),
    ...(reported.length > 0 ? { tokensUsed: reported.reduce((n, m) => n + (m.tokensUsed ?? 0), 0) } : {}),
  };
}

export function fleetBudgetDecision(budgets: Budgets, meters: readonly FeatureMeter[], reportsUsage: boolean): BudgetDecision {
  return budgetDecision(budgets, { ...fleetTotals(meters), reportsUsage });
}

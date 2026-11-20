import { describe, expect, it } from "vitest";
import { fleetBudgetDecision, fleetTotals } from "../../src/core/fleet-plan/budget.js";

const B = { wallClockMinutes: 60, maxTasks: 10, maxTokens: 1000 };

describe("fleet budget (feature 031)", () => {
  it("031:FR-011: task events and tokens are summed across features; wall-clock is the longest meter", () => {
    expect(fleetTotals([{ elapsedMs: 60_000, tasksUsed: 3, tokensUsed: 100 }, { elapsedMs: 90_000, tasksUsed: 4, tokensUsed: 50 }])).toEqual({
      elapsedMs: 90_000,
      tasksUsed: 7,
      tokensUsed: 150,
    });
  });

  it("031:FR-011: the fleet stops when the summed task budget is exceeded, though no feature alone exceeds it", () => {
    const d = fleetBudgetDecision(B, [{ elapsedMs: 0, tasksUsed: 6 }, { elapsedMs: 0, tasksUsed: 6 }], false);
    expect(d.exceeded).toBe(true);
    expect(d.reason).toContain("task budget");
  });

  it("031:FR-011: a token ceiling is enforced where every runner reports usage", () => {
    const d = fleetBudgetDecision(B, [{ elapsedMs: 0, tasksUsed: 1, tokensUsed: 600 }, { elapsedMs: 0, tasksUsed: 1, tokensUsed: 600 }], true);
    expect(d.exceeded).toBe(true);
    expect(d.reason).toContain("token ceiling");
  });

  it("031:FR-011: without usage reporting the ceiling is not enforced and the decision says so", () => {
    const d = fleetBudgetDecision(B, [{ elapsedMs: 0, tasksUsed: 1, tokensUsed: 5000 }], false);
    expect(d.exceeded).toBe(false);
    expect(d.unenforced.join(" ")).toContain("does not report usage");
  });

  it("031:FR-011: wall-clock over the limit stops the fleet", () => {
    expect(fleetBudgetDecision(B, [{ elapsedMs: 61 * 60_000, tasksUsed: 0 }], true).exceeded).toBe(true);
  });
});

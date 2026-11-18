import { describe, expect, it } from "vitest";
import { budgetDecision, mustTerminate, reassignGate, resolveBudgets, restartDecision } from "../../src/core/run-supervise.js";

describe("supervision rules (feature 028)", () => {
  it("028:FR-008: a stalled lane under the restart limit restarts", () => {
    expect(restartDecision({ stalled: true, restarts: 0, limit: 2 })).toBe("restart");
    expect(restartDecision({ stalled: true, restarts: 1, limit: 2 })).toBe("restart");
  });

  it("028:FR-009: a stalled lane at the restart limit pauses", () => {
    expect(restartDecision({ stalled: true, restarts: 2, limit: 2 })).toBe("pause");
    expect(restartDecision({ stalled: true, restarts: 0, limit: 0 })).toBe("pause");
  });

  it("028:FR-010: a lane that is not stalled (waiting, blocked, paused, done) is left alone", () => {
    expect(restartDecision({ stalled: false, restarts: 0, limit: 2 })).toBe("none");
    expect(restartDecision({ stalled: false, restarts: 5, limit: 2 })).toBe("none");
  });

  it("028:FR-009: moving a lane to another assistant needs a recorded approval for that lane and target", () => {
    expect(reassignGate([], "lane-1-1", "codex").allowed).toBe(false);
    const approvals = [{ kind: "reassign", lane: "lane-1-1", to: "codex", at: "2026-11-16T00:00:00Z" }];
    expect(reassignGate(approvals, "lane-1-1", "codex").allowed).toBe(true);
    expect(reassignGate(approvals, "lane-1-2", "codex").allowed).toBe(false);
    expect(reassignGate(approvals, "lane-1-1", "claude").allowed).toBe(false);
    expect(reassignGate([null, "x", { kind: "other" }], "lane-1-1", "codex").allowed).toBe(false);
  });

  it("028:FR-013: defaults are 120 minutes and twice the open tasks", () => {
    expect(resolveBudgets({ openTasks: 7 })).toEqual({ wallClockMinutes: 120, maxTasks: 14 });
  });

  it("028:FR-013: config sets the budgets and flags override config", () => {
    expect(resolveBudgets({ openTasks: 7, config: { wallClockMinutes: 30, maxTasks: 9 } })).toEqual({ wallClockMinutes: 30, maxTasks: 9 });
    expect(resolveBudgets({ openTasks: 7, config: { maxTasks: 9 }, flags: { maxTasks: 3, maxTokens: 500 } })).toEqual({ wallClockMinutes: 120, maxTasks: 3, maxTokens: 500 });
  });

  it("028:FR-014: exceeding the wall-clock budget stops the run and names why", () => {
    const b = { wallClockMinutes: 1, maxTasks: 10 };
    expect(budgetDecision(b, { elapsedMs: 59_000, tasksUsed: 0, reportsUsage: false }).exceeded).toBe(false);
    const d = budgetDecision(b, { elapsedMs: 61_000, tasksUsed: 0, reportsUsage: false });
    expect(d.exceeded).toBe(true);
    expect(d.reason).toContain("wall-clock");
  });

  it("028:FR-014: exceeding the task budget stops the run and names why", () => {
    const d = budgetDecision({ wallClockMinutes: 60, maxTasks: 4 }, { elapsedMs: 0, tasksUsed: 5, reportsUsage: false });
    expect(d.exceeded).toBe(true);
    expect(d.reason).toContain("task budget");
  });

  it("028:FR-013: a token ceiling is enforced only where the runner reports usage", () => {
    const b = { wallClockMinutes: 60, maxTasks: 10, maxTokens: 100 };
    const without = budgetDecision(b, { elapsedMs: 0, tasksUsed: 0, tokensUsed: 999, reportsUsage: false });
    expect(without.exceeded).toBe(false);
    expect(without.unenforced[0]).toContain("not enforceable");
    const withUsage = budgetDecision(b, { elapsedMs: 0, tasksUsed: 0, tokensUsed: 101, reportsUsage: true });
    expect(withUsage.exceeded).toBe(true);
    expect(withUsage.reason).toContain("token");
  });

  it("028:FR-013: no token ceiling set means nothing to report as unenforced", () => {
    expect(budgetDecision({ wallClockMinutes: 60, maxTasks: 10 }, { elapsedMs: 0, tasksUsed: 0, reportsUsage: false }).unenforced).toEqual([]);
  });

  it("028:FR-014: a lane is terminated only after it stays silent for the stop grace", () => {
    const base = { stopRequestedAt: 0, graceMinutes: 10 };
    expect(mustTerminate({ ...base, lastReportAt: null, now: 9 * 60_000 })).toBe(false);
    expect(mustTerminate({ ...base, lastReportAt: null, now: 11 * 60_000 })).toBe(true);
    expect(mustTerminate({ ...base, lastReportAt: 8 * 60_000, now: 11 * 60_000 })).toBe(false);
  });
});

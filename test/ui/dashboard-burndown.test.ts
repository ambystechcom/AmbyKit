import { describe, expect, it } from "vitest";
import type { Burndown } from "../../src/core/overview-types.js";
import { burndownPanel, maxPeriodsFor, plainBurndown } from "../../src/cli/ui/dashboard/burndown-chart.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ color: false });
const totals = [100, 104, 104, 110, 110, 112, 112, 118, 120, 120];
const remaining = [96, 90, 81, 72, 66, 52, 41, 33, 24, 17];
const ready: Burndown = {
  status: "ready",
  period: "weekly",
  points: totals.map((total, i) => ({
    periodStart: new Date(Date.UTC(2026, 7, 10 + 7 * i)).toISOString().slice(0, 10),
    total,
    remaining: remaining[i]!,
  })),
  deltaRemaining: -7,
};

describe("burndown panel (US-7, FR-018, FR-006)", () => {
  it("matches the wide wireframe", () => {
    const out = burndownPanel(caps, ready, 100, "wide").map(stripAnsi);
    expect(out[0]).toBe("╭─ BURNDOWN · weekly " + "─".repeat(66) + " 120 tasks ─╮");
    // 10 periods share the plot: 8-cell columns (the bar-width-max) plus a gap each.
    expect(out[1]).toMatch(/^│ 120 ┤ {28}(░{8} ){6}░{8} +│$/);
    expect(out[6]).toMatch(/^│ {3}0 ┤ (█{8} ){9}█{8} +│$/);
    expect(out[8]).toMatch(/Aug 10 +Sep 7 +Oct 12/);
    expect(out[10]).toContain("█ remaining   ░ done   now: 17 remaining · 103 done · −7 this week");
    for (const l of out) expect(visibleWidth(l)).toBe(100);
  });

  it("narrow uses the shorter height", () => {
    const out = burndownPanel(caps, ready, 80, "narrow");
    expect(out).toHaveLength(2 + 5 + 2 + 2);
  });

  it("ASCII: remaining # vs done : stays distinguishable without color", () => {
    const out = burndownPanel(fakeCapabilities({ color: false, unicode: false }), ready, 80, "narrow").join("\n");
    expect(out).toContain("#");
    expect(out).toContain(":");
    expect(out).toContain("-7 this week");
    expect(out).not.toMatch(/[^\x00-\x7f]/);
    expect(hasAnsi(out)).toBe(false);
  });

  it("feature filter shows in the title", () => {
    expect(stripAnsi(burndownPanel(caps, ready, 100, "wide", "014")[0]!)).toMatch(/^╭─ BURNDOWN · 014 · weekly /);
  });

  it("no-history and computing states are one line", () => {
    const none: Burndown = { status: "no-history", reason: "not-a-repo", points: [] };
    expect(stripAnsi(burndownPanel(caps, none, 60, "wide")[1]!)).toContain("— No history available: not a git repository.");
    const short: Burndown = { status: "no-history", reason: "too-little-history", points: [] };
    expect(stripAnsi(burndownPanel(caps, short, 90, "wide")[1]!)).toContain("No history available yet: tasks need changes in at least 2 periods.");
    expect(stripAnsi(burndownPanel(caps, "computing", 60, "wide")[1]!)).toContain("computing history…");
  });

  it("plain replaces the chart with a series line", () => {
    expect(plainBurndown(caps, ready)).toEqual([
      "BURNDOWN (weekly, Aug 10 - Oct 12)  now 17 remaining of 120, -7 this week",
      "  remaining: 96 90 81 72 66 52 41 33 24 17",
    ]);
    expect(plainBurndown(caps, { status: "no-history", reason: "not-a-repo", points: [] })).toEqual([
      "BURNDOWN  No history available: not a git repository.",
    ]);
  });

  it("max periods fit one cell plus a gap each", () => {
    expect(maxPeriodsFor(100)).toBe(45);
  });
});

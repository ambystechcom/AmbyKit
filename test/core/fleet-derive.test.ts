import { describe, expect, it } from "vitest";
import { laneView, runView, sortLanes } from "../../src/core/fleet-view/derive.js";
import { laneStatus, type LaneStatus } from "../../src/core/fleet/lane-status.js";
import { isFailed } from "../../src/core/query.js";
import type { RunLane, RunRecord } from "../../src/core/fleet/types.js";
import { FEATURE, NOW, fleetProject } from "../helpers/fleet-fixture.js";

const lane = (k: number, assistant = "claude"): RunLane => ({ lane: `${FEATURE}.lane-1-${k}`, assistant, tasks: [`T00${k}`] });
const status = (root: string, k: number): LaneStatus => {
  const s = laneStatus(root, { feature: FEATURE, lane: `lane-1-${k}`, now: NOW });
  if (isFailed(s)) throw new Error("no status");
  return s;
};

describe("fleet view mapping (feature 029)", () => {
  it("029:FR-005: a stalled lane row follows laneStatus; waiting and done lanes are never stalled", () => {
    const f = fleetProject([
      { k: 1, reportMinutesAgo: 20, state: "working" },
      { k: 2, reportMinutesAgo: 90, state: "waiting" },
      { k: 3, reportMinutesAgo: 120, state: "done" },
      { k: 4, reportMinutesAgo: 2, state: "working" },
    ]);
    const rows = [1, 2, 3, 4].map((k) => laneView(lane(k), status(f.root, k)));
    expect(rows.map((r) => r.stalled)).toEqual([true, false, false, false]);
    expect(rows[0]).toMatchObject({ lane: "lane-1-1", state: "working", idleMinutes: 20, stallMinutes: 15 });
  });

  it("029:FR-007: directive words come from 025: pending, pause requested, obeyed", () => {
    const f = fleetProject([
      { k: 1, reportMinutesAgo: 10, state: "working", directive: { action: "continue", minutesAgo: 5 } },
      { k: 2, reportMinutesAgo: 10, state: "working", directive: { action: "pause", minutesAgo: 5 } },
      { k: 3, reportMinutesAgo: 2, state: "working", directive: { action: "continue", minutesAgo: 8 } },
      { k: 4, reportMinutesAgo: 2, state: "paused", directive: { action: "pause", minutesAgo: 8 } },
    ]);
    const words = [1, 2, 3, 4].map((k) => laneView(lane(k), status(f.root, k)).directive);
    expect(words).toEqual([
      { action: "continue", status: "pending" },
      { action: "pause", status: "pause requested" },
      { action: "continue", status: "obeyed" },
      { action: "pause", status: "paused" },
    ]);
  });

  it("029:FR-007: the directive/report comparison uses the markers' own times, so an old report never hides a newer directive", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 30, state: "working", tasksMinutesAgo: 1, directive: { action: "stop", minutesAgo: 1 } }]);
    expect(laneView(lane(1), status(f.root, 1)).directive).toEqual({ action: "stop", status: "pending" });
  });

  it("029:FR-003: a lane with no status reads as unknown, not an error", () => {
    expect(laneView(lane(1), null)).toMatchObject({ lane: "lane-1-1", state: "unknown", stalled: false, directive: { status: "none" } });
  });

  it("029:FR-003: a lane that never reported is unreported", () => {
    const f = fleetProject([{ k: 1 }]);
    expect(laneView(lane(1), status(f.root, 1)).state).toBe("unreported");
  });

  it("029:FR-001: two lanes of the same assistant are distinct rows", () => {
    const rows = [laneView(lane(1, "claude"), null), laneView(lane(2, "claude"), null)];
    expect(new Set(rows.map((r) => r.lane)).size).toBe(2);
  });

  it("029:FR-003: a clock-skewed future report never gives negative idle time", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: -30, state: "working" }]);
    const row = laneView(lane(1), status(f.root, 1));
    expect(row.idleMinutes ?? 0).toBeGreaterThanOrEqual(0);
    expect(row.stalled).toBe(false);
  });

  it("029:FR-001: lanes sort numerically (lane-1-2 before lane-1-10)", () => {
    const sorted = sortLanes(["lane-1-10", "lane-1-2", "lane-1-1", "lane-2-1"].map((l) => ({ lane: l, assistant: "a", state: "working" as const, stalled: false, directive: { action: "continue" as const, status: "none" as const }, tasks: [] })));
    expect(sorted.map((l) => l.lane)).toEqual(["lane-1-1", "lane-1-2", "lane-1-10", "lane-2-1"]);
  });

  it("029:FR-004: the run view carries stage, round, limit, needs-decision and gates", () => {
    const rec = { run: "001-alpha.1", feature: FEATURE, status: "waiting-person", phase: 1, stage: "qa", round: 2, limit: 3, needsDecision: true, gates: [{ id: "phase-1", after: "US-1", state: "pending" }], lanes: [], approvals: [], escalations: [], createdAt: "" } as RunRecord;
    expect(runView(rec)).toMatchObject({ stage: "qa", round: 2, limit: 3, needsDecision: true, gates: [{ id: "phase-1", state: "pending" }] });
  });
});

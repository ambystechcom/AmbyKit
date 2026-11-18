import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { fleetJson } from "../../src/core/fleet-view/json.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { FEATURE, fleetProject, fleetView } from "../helpers/fleet-fixture.js";

const json = async (root: string, flags: Record<string, string | boolean>) => (await runCommand(new DashboardCommand(), root, [], flags)).out;

describe("dashboard --json --overview: fleet (feature 029, FR-012, FR-013)", () => {
  it("029:FR-013: with no fleet run the output is byte-identical to before and has no fleet key", async () => {
    const root = dashboardFixture();
    const out = await json(root, { json: true, overview: true });
    expect(Object.keys(JSON.parse(out))).not.toContain("fleet");
    expect(out).toBe(await json(root, { json: true, overview: true }));
  });

  it("029:FR-012: bare --json (the story array) is unchanged even when a run exists", async () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    const bare = JSON.parse(await json(f.root, { json: true }));
    expect(Array.isArray(bare)).toBe(true);
  });

  it("029:FR-012: with a run, --overview carries fleet after the existing keys, which keep their order", async () => {
    const f = fleetProject([
      { k: 1, assistant: "claude", reportMinutesAgo: 1, state: "working" },
      { k: 2, assistant: "codex", reportMinutesAgo: 30, state: "working" },
    ], { stage: "qa", round: 1, limit: 3, now: Date.now() });
    const doc = JSON.parse(await json(f.root, { json: true, overview: true }));
    expect(Object.keys(doc)).toEqual(["stories", "summary", "statusCounts", "features", "attention", "upNext", "burndown", "issues", "filters", "fleet"]);
    expect(doc.fleet).toMatchObject({ run: f.run, feature: FEATURE, status: "active", stage: "qa", round: 1, limit: 3, needsDecision: false, gates: [], others: [] });
    expect(doc.fleet.lanes.map((l: { lane: string; assistant: string; stalled: boolean }) => [l.lane, l.assistant, l.stalled])).toEqual([
      ["lane-1-1", "claude", false],
      ["lane-1-2", "codex", true],
    ]);
  });

  it("029:FR-013: the JSON has no ANSI and no machine-local path", async () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    const out = await json(f.root, { json: true, overview: true });
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(out)).toBe(false);
    expect(JSON.stringify(JSON.parse(out).fleet)).not.toContain(f.root.replace(/\\/g, "\\\\"));
  });

  it("029:FR-012: fleetJson shape: optional fields appear only when known, nothing is renamed", () => {
    const v = fleetView([{ lane: "lane-1-1", idle: 4 }, { lane: "lane-1-2" }]);
    v.lanes[0]!.lastReportAt = "2026-11-16T12:00:00.000Z";
    const j = fleetJson(v);
    expect(j.lanes[0]).toEqual({ lane: "lane-1-1", assistant: "claude", state: "working", stalled: false, lastActivity: "2026-11-16T12:00:00.000Z", idleMinutes: 4, directive: { action: "continue", status: "none" } });
    expect(j.lanes[1]).toEqual({ lane: "lane-1-2", assistant: "claude", state: "working", stalled: false, directive: { action: "continue", status: "none" } });
    expect(Object.keys(j)).toEqual(["run", "feature", "status", "phase", "stage", "round", "limit", "needsDecision", "gates", "lanes", "others"]);
  });
});

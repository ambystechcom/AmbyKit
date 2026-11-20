import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { createRun, fleetRoot, runDir, updateRun } from "../../src/core/fleet/runs.js";
import { FEATURE, NOW, fleetProject, writeRunJson } from "../helpers/fleet-fixture.js";

describe("readFleet (feature 029)", () => {
  it("029:FR-013: no run ⇒ null, and a project that never ran a fleet is not touched", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }], { noRun: true });
    expect(existsSync(fleetRoot(f.root))).toBe(false);
    expect(readFleet(f.root, NOW)).toBeNull();
    expect(existsSync(fleetRoot(f.root))).toBe(false);
  });

  it("029:FR-001: reads every lane of the run with assistant, state and quiet time", () => {
    const f = fleetProject([
      { k: 1, assistant: "claude", reportMinutesAgo: 1, state: "working" },
      { k: 2, assistant: "codex", reportMinutesAgo: 25, state: "working" },
      { k: 3, assistant: "claude", reportMinutesAgo: 4, state: "waiting" },
    ]);
    const v = readFleet(f.root, NOW)!;
    expect(v.run).toMatchObject({ run: f.run, feature: FEATURE, status: "active", stage: "working" });
    expect(v.lanes.map((l) => [l.lane, l.assistant, l.state, l.stalled])).toEqual([
      ["lane-1-1", "claude", "working", false],
      ["lane-1-2", "codex", "working", true],
      ["lane-1-3", "claude", "waiting", false],
    ]);
  });

  it("029:FR-004: stage, round, limit and needs-decision come from run.json", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }], { stage: "architect", round: 2, limit: 3, needsDecision: true });
    expect(readFleet(f.root, NOW)!.run).toMatchObject({ stage: "architect", round: 2, limit: 3, needsDecision: true });
  });

  it("029:FR-009: pending gates are read from gates[]", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "paused" }], { status: "waiting-person", gates: [{ id: "phase-1", after: "US-1", state: "pending" }] });
    expect(readFleet(f.root, NOW)!.run.gates).toEqual([{ id: "phase-1", after: "US-1", state: "pending" }]);
  });

  it("029:FR-003: a corrupt run.json means no run, not an error", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    writeRunJson(f, "{ not json");
    expect(readFleet(f.root, NOW)).toBeNull();
  });

  it("029:FR-003: a run lane with no checkout and no report is unreported (a worker not started); the rest still show", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    updateRun(f.root, f.run, { lanes: [{ lane: `${FEATURE}.lane-1-1`, assistant: "claude", tasks: ["T001"] }, { lane: `${FEATURE}.lane-1-9`, assistant: "codex", tasks: ["T009"] }] });
    const v = readFleet(f.root, NOW)!;
    expect(v.lanes.map((l) => [l.lane, l.state])).toEqual([["lane-1-1", "working"], ["lane-1-9", "unreported"]]);
  });

  it("029:FR-013: a finished run is not shown; with several unfinished runs the newest shows and the others are listed", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    updateRun(f.root, f.run, { status: "done" });
    expect(readFleet(f.root, NOW)).toBeNull();
    const second = createRun(f.root, FEATURE, { lanes: [] });
    const third = createRun(f.root, FEATURE, { lanes: [] });
    if (!second.ok || !third.ok) throw new Error("run");
    const v = readFleet(f.root, NOW)!;
    expect(v.run.run).toBe(third.run.run);
    expect(v.others).toEqual([second.run.run]);
  });

  it("029:FR-003: an unreadable fleet directory entry is ignored", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    mkdirSync(join(runDir(f.root, "junk-dir.1")), { recursive: true });
    writeFileSync(join(fleetRoot(f.root), "stray.txt"), "x");
    expect(readFleet(f.root, NOW)!.run.run).toBe(f.run);
  });
});

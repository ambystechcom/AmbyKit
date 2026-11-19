import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { runDir } from "../../src/core/fleet/runs.js";
import { NOW, fleetProject, writeRunJson } from "../helpers/fleet-fixture.js";
import { writeFileSync } from "node:fs";

const lane = [{ k: 1, reportMinutesAgo: 1, state: "working" as const }];

describe("fleet review-loop state (feature 029, FR-004)", () => {
  it.each(["working", "qa", "architect"] as const)("029:FR-004: stage %s is read from run.json", (stage) => {
    const f = fleetProject(lane, { stage, round: 1, limit: 3 });
    expect(readFleet(f.root, NOW)!.run).toMatchObject({ stage, round: 1, limit: 3, needsDecision: false });
  });

  it("029:FR-004: round against the limit and the needs-decision mark are read", () => {
    const f = fleetProject(lane, { stage: "architect", round: 3, limit: 3, needsDecision: true });
    expect(readFleet(f.root, NOW)!.run).toMatchObject({ stage: "architect", round: 3, limit: 3, needsDecision: true });
  });

  it("029:FR-004: a run.json without stage, round, limit or needsDecision reads as working, not an error", () => {
    const f = fleetProject(lane);
    writeRunJson(f, JSON.stringify({ run: f.run, feature: f.feature, status: "active", lanes: [{ lane: `${f.feature}.lane-1-1`, assistant: "claude", tasks: ["T001"] }] }));
    const v = readFleet(f.root, NOW)!;
    expect(v.run).toMatchObject({ stage: "working", round: 0, limit: 0, needsDecision: false, gates: [] });
    expect(v.lanes).toHaveLength(1);
  });

  it("029:FR-004: an unknown stage value falls back to working", () => {
    const f = fleetProject(lane);
    writeFileSync(join(runDir(f.root, f.run), "run.json"), JSON.stringify({ run: f.run, feature: f.feature, status: "active", stage: "deploy", lanes: [] }));
    expect(readFleet(f.root, NOW)!.run.stage).toBe("working");
  });
});

import { utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeMarker } from "../../src/core/activity.js";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { FEATURE, NOW, ago, fleetProject } from "../helpers/fleet-fixture.js";

const stalled = (root: string, now = NOW) => readFleet(root, now)!.lanes.map((l) => l.stalled);

describe("fleet stalled lanes (feature 029, FR-005, SC-002)", () => {
  it("029:FR-005: a working lane over the limit stalls; a recent one, and waiting, paused and done lanes, do not", () => {
    const f = fleetProject([
      { k: 1, reportMinutesAgo: 16, state: "working" },
      { k: 2, reportMinutesAgo: 14, state: "working" },
      { k: 3, reportMinutesAgo: 60, state: "waiting" },
      { k: 4, reportMinutesAgo: 60, state: "paused" },
      { k: 5, reportMinutesAgo: 60, state: "done" },
    ]);
    expect(stalled(f.root)).toEqual([true, false, false, false, false]);
  });

  it("029:FR-005: the limit is fleet.stallMinutes, not the dashboard's idle limit", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 8, state: "working" }], { config: { fleet: { stallMinutes: 5 }, dashboard: { idleMinutes: 30 } } });
    expect(readFleet(f.root, NOW)!.lanes[0]).toMatchObject({ stalled: true, stallMinutes: 5, idleMinutes: 8 });
  });

  it("029:FR-005: a tasks.md change resets the clock even when the last report is old", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 45, state: "working", tasksMinutesAgo: 45 }]);
    expect(stalled(f.root)).toEqual([true]);
    const file = join(f.laneRoots["lane-1-1"]!, "specs", FEATURE, "tasks.md");
    utimesSync(file, ago(2), ago(2));
    expect(stalled(f.root)).toEqual([false]);
  });

  it("029:FR-005, SC-002: a lane crossing the limit stalls on the next read, and clears on the next report", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 14, state: "working", tasksMinutesAgo: 14 }]);
    expect(stalled(f.root, NOW)).toEqual([false]);
    expect(stalled(f.root, NOW + 2 * 60_000)).toEqual([true]);
    writeMarker(f.laneRoots["lane-1-1"]!, { feature: FEATURE, agent: "claude", phase: "implement", at: new Date(NOW + 3 * 60_000).toISOString(), lane: `${FEATURE}.lane-1-1`, state: "working" });
    expect(stalled(f.root, NOW + 3 * 60_000)).toEqual([false]);
  });

  it("029:FR-005: a lane that never reported is unreported, not stalled", () => {
    const f = fleetProject([{ k: 1 }]);
    expect(readFleet(f.root, NOW)!.lanes[0]).toMatchObject({ state: "unreported", stalled: false });
  });
});

import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeMarker } from "../../src/core/activity.js";
import { directivePath } from "../../src/core/fleet/directives.js";
import { laneStatus } from "../../src/core/fleet/lane-status.js";
import { createRun } from "../../src/core/fleet/runs.js";
import { addLaneCheckout, project, tasksMd } from "../mcp/fixture.js";

const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000);
const FEATURE = "001-alpha";

function setup(config: Record<string, unknown> = {}) {
  const root = project([{ dir: FEATURE, stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }], config);
  const laneRoot = addLaneCheckout(root, FEATURE, 1, 1, ["T001"], tasksMd(FEATURE, [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }]));
  return { root, laneRoot };
}
const report = (laneRoot: string, minutesAgo: number, state?: string) =>
  writeMarker(laneRoot, {
    feature: FEATURE,
    agent: "claude",
    phase: "implement",
    at: ago(minutesAgo).toISOString(),
    lane: `${FEATURE}.lane-1-1`,
    ...(state ? { state: state as never } : {}),
  });
const touchTasks = (laneRoot: string, minutesAgo: number) => {
  const f = join(laneRoot, "specs", FEATURE, "tasks.md");
  utimesSync(f, ago(minutesAgo), ago(minutesAgo));
};
const status = (root: string, extra: Record<string, unknown> = {}) => laneStatus(root, { feature: FEATURE, lane: "lane-1-1", now: NOW, ...extra });

describe("laneStatus (FR-014)", () => {
  it("025:FR-014: a working lane with no report and no tasks.md change for 15 minutes is stalled", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 20, "working");
    touchTasks(laneRoot, 20);
    expect(status(root)).toMatchObject({ lane: "lane-1-1", state: "working", stalled: true, idleMinutes: 20, stallMinutes: 15 });
  });

  it("025:FR-014: a recent report means not stalled", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 2, "working");
    touchTasks(laneRoot, 40);
    expect(status(root)).toMatchObject({ stalled: false, idleMinutes: 2 });
  });

  it("025:FR-014: a recent tasks.md change counts as activity even when the last report is old", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 60, "working");
    touchTasks(laneRoot, 3);
    expect(status(root)).toMatchObject({ stalled: false, idleMinutes: 3 });
  });

  it("025:FR-014: a marker with no state is read as working", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 30);
    touchTasks(laneRoot, 30);
    expect(status(root)).toMatchObject({ state: "working", stalled: true });
  });

  it.each(["waiting", "blocked", "paused", "done"])("025:FR-014: a lane that reported %s never counts as stalled", (state) => {
    const { root, laneRoot } = setup();
    report(laneRoot, 240, state);
    touchTasks(laneRoot, 240);
    expect(status(root)).toMatchObject({ state, stalled: false });
  });

  it("025:FR-014: the limit is configurable (fleet.stallMinutes)", () => {
    const { root, laneRoot } = setup({ fleet: { stallMinutes: 5 } });
    report(laneRoot, 8, "working");
    touchTasks(laneRoot, 8);
    expect(status(root)).toMatchObject({ stalled: true, stallMinutes: 5 });
    const other = setup({ fleet: { stallMinutes: 45 } });
    report(other.laneRoot, 30, "working");
    touchTasks(other.laneRoot, 30);
    expect(status(other.root)).toMatchObject({ stalled: false, stallMinutes: 45 });
  });

  it("025:FR-014: independent of the dashboard's idle limit: 20 idle minutes stall a lane even when the dashboard's idle limit is 30", () => {
    const { root, laneRoot } = setup({ dashboard: { activeMinutes: 2, idleMinutes: 30 } });
    report(laneRoot, 20, "working");
    touchTasks(laneRoot, 20);
    expect(status(root)).toMatchObject({ stalled: true, stallMinutes: 15 });
  });

  it("025:FR-014: a lane that has not reported yet is unreported, not stalled", () => {
    const { root, laneRoot } = setup();
    touchTasks(laneRoot, 90);
    expect(status(root)).toMatchObject({ state: "unreported", stalled: false });
  });

  it("025:FR-014: the exact limit is not yet stalled; one minute past it is", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 15, "working");
    touchTasks(laneRoot, 15);
    expect(status(root)).toMatchObject({ stalled: false });
    report(laneRoot, 16, "working");
    touchTasks(laneRoot, 16);
    expect(status(root)).toMatchObject({ stalled: true });
  });

  it("025:FR-014: a report from the future (clock skew) is treated as now", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, -30, "working");
    touchTasks(laneRoot, 90);
    expect(status(root)).toMatchObject({ stalled: false, idleMinutes: 0 });
  });

  it("025:FR-022: carries the lane's directive and its derived status when a run exists", () => {
    const { root, laneRoot } = setup();
    const made = createRun(root, FEATURE);
    if (!made.ok) throw new Error(made.warning);
    const p = directivePath(root, made.run.run, "lane-1-1");
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify({ action: "pause", at: ago(5).toISOString() }));
    report(laneRoot, 1, "working");
    expect(status(root)).toMatchObject({ directive: { action: "pause", status: "pause requested" }, run: made.run.run });
    report(laneRoot, 0, "paused");
    expect(status(root).directive).toEqual({ action: "pause", status: "paused" });
  });

  it("025:FR-011: with no run or directive the lane's directive is continue / none", () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 1, "working");
    expect(status(root).directive).toEqual({ action: "continue", status: "none" });
  });

  it("025:FR-002: an unknown lane is an error naming it and the real ones", () => {
    const { root } = setup();
    const out = laneStatus(root, { feature: FEATURE, lane: "lane-9-9", now: NOW });
    expect(out).toMatchObject({ error: expect.stringMatching(/lane 'lane-9-9' not found.*lane-1-1/) });
  });

  it("025:FR-002: with no lane given and not running in one it says so", () => {
    const { root } = setup();
    expect(laneStatus(root, { feature: FEATURE, now: NOW })).toMatchObject({ error: expect.stringMatching(/no lane given/) });
  });

  it("025:FR-014: run inside a lane checkout, the lane defaults to that lane", () => {
    const { laneRoot } = setup();
    report(laneRoot, 1, "working");
    expect(laneStatus(laneRoot, { feature: FEATURE, now: NOW })).toMatchObject({ lane: "lane-1-1", state: "working" });
  });
});

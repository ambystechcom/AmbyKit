import { utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeMarker } from "../../src/core/activity.js";
import { addLaneCheckout, project, tasksMd } from "./fixture.js";
import { callTool, converse } from "./helpers.js";

const FEATURE = "001-alpha";
function setup(config: Record<string, unknown> = {}) {
  const root = project([{ dir: FEATURE, stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }], config);
  const laneRoot = addLaneCheckout(root, FEATURE, 1, 1, ["T001"], tasksMd(FEATURE, [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }]));
  return { root, laneRoot };
}
const report = (laneRoot: string, minutesAgo: number, state: string) => {
  writeMarker(laneRoot, { feature: FEATURE, agent: "claude", phase: "implement", at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), lane: `${FEATURE}.lane-1-1`, state: state as never });
  const old = new Date(Date.now() - minutesAgo * 60_000);
  utimesSync(join(laneRoot, "specs", FEATURE, "tasks.md"), old, old);
};

describe("lane_status tool", () => {
  it("025:FR-014: is published and takes feature, lane and run", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const tool = r!.result.tools.find((t: { name: string }) => t.name === "lane_status");
    expect(Object.keys(tool.inputSchema.properties).sort()).toEqual(["feature", "lane", "run"]);
  });

  it("025:FR-014: reports a lane left working past the limit as stalled", async () => {
    const { root, laneRoot } = setup();
    report(laneRoot, 25, "working");
    const out = await callTool("lane_status", { feature: "001", lane: "lane-1-1" }, { cwd: root });
    expect(out.isError).toBe(false);
    expect(out.body).toMatchObject({ lane: "lane-1-1", state: "working", stalled: true, stallMinutes: 15, directive: { action: "continue", status: "none" } });
  });

  it("025:FR-014: waiting, blocked and done lanes are never stalled", async () => {
    for (const state of ["waiting", "blocked", "done"]) {
      const { root, laneRoot } = setup();
      report(laneRoot, 300, state);
      const out = await callTool("lane_status", { feature: "001", lane: "1-1" }, { cwd: root });
      expect(out.body, state).toMatchObject({ state, stalled: false });
    }
  });

  it("025:FR-002: unknown lane and unknown feature are errors that name them", async () => {
    const { root } = setup();
    const lane = await callTool("lane_status", { feature: "001", lane: "lane-4-4" }, { cwd: root });
    const feature = await callTool("lane_status", { feature: "404", lane: "lane-1-1" }, { cwd: root });
    expect([lane.isError, feature.isError]).toEqual([true, true]);
    expect(lane.body.error).toMatch(/lane-4-4/);
    expect(feature.body.error).toMatch(/404/);
  });

  it("025:FR-014: the configured limit is used", async () => {
    const { root, laneRoot } = setup({ fleet: { stallMinutes: 2 } });
    report(laneRoot, 5, "working");
    const out = await callTool("lane_status", { feature: "001", lane: "lane-1-1" }, { cwd: root });
    expect(out.body).toMatchObject({ stalled: true, stallMinutes: 2 });
  });
});

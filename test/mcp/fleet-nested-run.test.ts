import { describe, expect, it } from "vitest";
import { controlFleet } from "../../src/cli/run-fleet-control.js";
import { createFleet, createRun, fleetOfRun, updateRun } from "../../src/core/fleet/index.js";
import { project } from "./fixture.js";
import { callTool } from "./helpers.js";

const make = () => project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }]);
const args = { feature: "001", agent: "claude", phase: "implement", state: "working", lane: "lane-1-1" };

function inFleet(cwd: string): string {
  createFleet(cwd, {
    features: [{ feature: "001-alpha", state: "running", waitsFor: [], ownership: { files: [], unknown: [] }, fingerprint: "f", run: "001-alpha.1" }],
    caps: { total: 3, perType: 2 },
    budgets: { wallClockMinutes: 60, maxTasks: 10 },
    unattended: false,
  });
  const made = createRun(cwd, "001-alpha", { fleet: "fleet-1", lanes: [{ lane: "001-alpha.lane-1-1", assistant: "claude", tasks: ["T001"] }] });
  if (!made.ok) throw new Error(made.warning);
  return made.run.run;
}

describe("report_activity finds a run inside its fleet directory (feature 031, US-8)", () => {
  it("031:FR-021: a report that names no run resolves the feature's unfinished run nested in its fleet", async () => {
    const cwd = make();
    const run = inFleet(cwd);
    expect(fleetOfRun(cwd, run)).toBe("fleet-1");
    const out = await callTool("report_activity", args, { cwd });
    expect(out.isError).toBe(false);
    expect(out.body).toMatchObject({ ack: true, directive: "continue", run });
    expect(out.body.warning).toBeUndefined();
  });

  it("031:FR-015: the directive a fleet writes for a lane reaches the worker's next report", async () => {
    const cwd = make();
    inFleet(cwd);
    controlFleet(cwd, "fleet-1", "pause");
    const out = await callTool("report_activity", args, { cwd });
    expect(out.body).toMatchObject({ ack: true, directive: "pause", run: "001-alpha.1" });
  });

  it("031:FR-021: naming the nested run explicitly works too", async () => {
    const cwd = make();
    const run = inFleet(cwd);
    const out = await callTool("report_activity", { ...args, run }, { cwd });
    expect(out.body).toMatchObject({ ack: true, run });
  });

  it("031:FR-021: a finished nested run is not the one a report belongs to", async () => {
    const cwd = make();
    const run = inFleet(cwd);
    updateRun(cwd, run, { status: "done" });
    const out = await callTool("report_activity", args, { cwd });
    expect(out.body.warning).toMatch(/no unfinished run/);
  });

  it("031:FR-019: a flat single run is resolved exactly as before", async () => {
    const cwd = make();
    const made = createRun(cwd, "001-alpha");
    if (!made.ok) throw new Error(made.warning);
    const out = await callTool("report_activity", args, { cwd });
    expect(out.body).toMatchObject({ ack: true, run: made.run.run });
    expect(fleetOfRun(cwd, made.run.run)).toBeUndefined();
  });
});

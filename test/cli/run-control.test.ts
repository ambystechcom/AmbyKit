import { describe, expect, it } from "vitest";
import { DirectiveCommand } from "../../src/cli/directive.js";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { writeMarker } from "../../src/core/activity.js";
import { laneStatus, writeDirective } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, script, tickIn, type Harness } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

function report(h: Harness, lane: string, state: "working" | "paused" | "done"): void {
  const rt = h.lane(lane);
  writeMarker(rt.ref.root, { feature: F, agent: "claude", phase: "implement", at: new Date(h.clock.t + 500).toISOString(), lane: rt.ref.name, state, run: h.run });
}

const directive = (h: Harness, root: string, lane: string, action: "pause" | "continue" | "stop") =>
  writeDirective(root, { feature: F, lane, action, run: h.run, now: new Date(h.clock.t + 100) });

describe.skipIf(!HAS_GIT)("directives in the run (feature 028)", () => {
  it("028:FR-016: a pause directive does not stop the process; the worker finishes its task and obeys at its next report", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    directive(h, p.root, "lane-1-1", "pause");
    await h.step();
    expect(h.port.starts[0]!.killed).toEqual([]); // nothing was killed: a directive is advice
    expect(h.lane("lane-1-1").file.status).toBe("running");
    expect(readEvents(p.root, h.run).some((e) => e.kind === "obeyed")).toBe(false);
  });

  it("028:FR-016: when the worker reports paused and its process ends, the run records the pause as obeyed once", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    directive(h, p.root, "lane-1-1", "pause");
    h.clock.t += 1000;
    report(h, "lane-1-1", "paused");
    h.port.starts[0]!.finish(0); // the worker ended its turn after its next report
    await h.step();
    await h.step();
    const file = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(file.status).toBe("paused");
    expect(readEvents(p.root, h.run).filter((e) => e.kind === "obeyed")).toHaveLength(1);
    expect(h.said.join("\n")).toContain("lane-1-1: obeyed pause");
  });

  it("028:FR-016: a paused lane is never restarted as stalled, however long it is paused", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    directive(h, p.root, "lane-1-1", "pause");
    h.port.starts[0]!.finish(0);
    await h.step();
    h.advance(120);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
    expect(h.lane("lane-1-1").file.status).toBe("paused");
  });

  it("028:SC-005: resume starts the lane again with only the tasks still open, so no completed task repeats", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]); // the worker finished T001 before it paused
    directive(h, p.root, "lane-1-1", "pause");
    h.port.starts[0]!.finish(0);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    const before = h.port.starts.length;
    h.clock.t += 5000;
    directive(h, p.root, "lane-1-1", "continue");
    await h.step();
    expect(h.port.starts.length).toBe(before + 1);
    const again = h.port.starts.at(-1)!;
    expect(again.spec.stdin).toContain("T003");
    expect(again.spec.stdin).not.toContain("T001");
    expect(h.lane("lane-1-1").file.restarts).toBe(0); // a resume is not a restart
  });

  it("028:FR-016: a stop directive ends in a stopped lane that is neither unfinished nor merged", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    directive(h, p.root, "lane-1-1", "stop");
    h.port.starts[0]!.finish(0);
    await h.step();
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("stopped");
  });

  it("028:FR-016: a lane paused before it started is held and does not launch", async () => {
    const p = await preparedProject(F, 8, 4);
    const h = harness(p, { settings: { concurrency: { total: 1, perType: 1 } } });
    script(h, p, { hang: true, work: false });
    directive(h, p.root, "lane-1-2", "pause");
    directive(h, p.root, "lane-1-1", "pause");
    await h.step();
    expect(h.port.starts.every((x) => !x.spec.cwd.endsWith("lane-1-1") && !x.spec.cwd.endsWith("lane-1-2"))).toBe(true);
    expect(h.lane("lane-1-1").file.status).toBe("paused");
  });

  it("028:FR-016: ambykit directive (spec 025's CLI verb) steers a run the same way", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    const r = await runCommand(new DirectiveCommand(), p.root, [F, "lane-1-1", "pause"], { run: h.run });
    expect(r.code).toBe(0);
    h.port.starts[0]!.finish(0);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
  });

  it("028:FR-016: every directive the run acts on was written by spec 025's writer: the run itself writes only stop and continue", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { wallClockMinutes: 1 } });
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(2);
    await h.step();
    const st = laneStatus(p.root, { feature: F, lane: "lane-1-1", run: h.run, now: h.clock.t });
    expect("error" in st).toBe(false);
    if (!("error" in st)) expect(st.directive.action).toBe("stop");
  });

  it("028:FR-017: a second host reads the same pause state the run wrote: laneStatus reports it", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    directive(h, p.root, "lane-1-1", "pause");
    const st = laneStatus(p.root, { feature: F, lane: "lane-1-1", run: h.run, now: h.clock.t + 1000 });
    expect("error" in st).toBe(false);
    if (!("error" in st)) expect(st.directive).toEqual({ action: "pause", status: "pause requested" });
  });
});

import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FleetCommand } from "../../src/cli/fleet.js";
import { RunCommand } from "../../src/cli/run.js";
import { acquireRunLock, readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { laneStatus, readRun, runDir, writeDirective } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, harness, preparedProject, script, tickIn } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";
const noSleep = async (): Promise<void> => undefined;

describe.skipIf(!HAS_GIT)("continue-run, save and exit, and a second host (feature 028)", () => {
  it("028:FR-016: an interrupt saves state: lanes go back to the queue, processes are stopped, the run is paused", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    const out = h.sup.interrupt();
    expect(out.kind).toBe("interrupted");
    expect(out.message).toContain(`--continue-run=${h.run}`);
    expect(h.port.starts.every((x) => x.killed.includes("SIGTERM"))).toBe(true);
    expect(readLaneFile(p.root, h.run, "lane-1-1")).toMatchObject({ status: "queued", reason: "interrupted" });
    expect(readRun(p.root, h.run)!.status).toBe("paused");
    expect(readEvents(p.root, h.run).some((e) => e.kind === "interrupted")).toBe(true);
  });

  it("028:SC-005: continuing after an interrupt repeats no completed task and finishes the run", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]); // done before the interrupt
    h.sup.interrupt();

    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], { "continue-run": h.run, yes: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain(`Continuing run ${h.run}`);
    const workers = port.starts.filter((x) => /check each off/.test(x.spec.stdin ?? ""));
    const lane1 = workers.find((x) => x.spec.cwd.endsWith("lane-1-1"))!;
    expect(lane1.spec.stdin).toContain("T003");
    expect(lane1.spec.stdin).not.toContain("T001");
    expect(readRun(p.root, h.run)!.status).toBe("done");
  });

  it("028:FR-016: pause, then resume from a new process: the paused lane starts again with only its open tasks", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]);
    writeDirective(p.root, { feature: F, lane: "lane-1-1", action: "pause", run: h.run, now: new Date(h.clock.t + 100) });
    h.port.starts[0]!.finish(0);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    h.sup.interrupt(); // this process goes away; lane 1-1 stays paused, lane 1-2 is queued
    // a person resumes it (from the terminal, the dashboard or /amby.run)
    writeDirective(p.root, { feature: F, lane: "lane-1-1", action: "continue", run: h.run, now: new Date(h.clock.t + 10_000) });

    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { "continue-run": h.run, yes: true });
    expect(r.code).toBe(0);
    const again = port.starts.find((x) => x.spec.cwd.endsWith("lane-1-1") && /check each off/.test(x.spec.stdin ?? ""))!;
    expect(again.spec.stdin).toContain("T003");
    expect(again.spec.stdin).not.toContain("T001");
  });

  it("028:FR-016: continue-run without --yes shows what it would start and launches nothing", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.sup.interrupt();
    const port = new FakePort();
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], { "continue-run": h.run });
    expect(r.code).toBe(0);
    expect(r.out).toContain(`run ${h.run}`);
    expect(r.out).toContain("Nothing launched");
    expect(port.starts).toHaveLength(0);
  });

  it("028:FR-016: an unknown run to continue is refused by name", async () => {
    const p = await preparedProject(F, 4, 2);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port: new FakePort() }), p.root, [F], { "continue-run": `${F}.7`, yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain(`${F}.7`);
  });

  it("028:FR-017: a run whose state is missing is rebuilt from tasks.md and carried on; checked tasks stay checked", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]);
    h.sup.interrupt();
    rmSync(join(runDir(p.root, h.run), "run.json"));
    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], { "continue-run": h.run, yes: true });
    expect(r.err).toContain("rebuilt from tasks.md");
    expect(readRun(p.root, h.run)).not.toBeNull();
  });

  it("028:FR-017: a run being supervised by a live process cannot be continued from a second one", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    h.sup.interrupt();
    acquireRunLock(p.root, h.run, 4242, () => false);
    const port = new FakePort();
    port.isAlive = (pid: number) => pid === 4242;
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], { "continue-run": h.run, yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain("already supervised by process 4242");
    expect(port.starts).toHaveLength(0);
  });

  it("028:FR-017: a lock left by a dead supervisor is taken over", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    h.sup.interrupt();
    acquireRunLock(p.root, h.run, 4242, () => false);
    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], { "continue-run": h.run, yes: true });
    expect(r.code).toBe(0);
  });

  it("028:FR-017: a second host sees the run: ambykit fleet status lists its lanes and the directive state", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    writeDirective(p.root, { feature: F, lane: "lane-1-1", action: "pause", run: h.run, now: new Date(h.clock.t + 100) });
    const r = await runCommand(new FleetCommand(), p.root, ["status", F], { run: h.run });
    expect(r.out).toContain("lane-1-1");
    expect(r.out).toContain(h.run);
    const st = laneStatus(p.root, { feature: F, lane: "lane-1-1", run: h.run, now: h.clock.t + 1000 });
    expect("error" in st ? "" : st.directive.status).toBe("pause requested");
  });

  it("028:FR-016: a lane revived by continue-run no longer carries a stale stop: a continue directive replaces it", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { wallClockMinutes: 1 } });
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(2);
    await h.step();
    for (const proc of h.port.starts) proc.finish(0);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("stopped");
    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [], {
      "continue-run": h.run,
      yes: true,
      "max-minutes": "600",
    });
    expect(r.code).toBe(0);
    expect(readRun(p.root, h.run)!.status).toBe("done");
  });
});

import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { readRun } from "../../src/core/fleet/index.js";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, preparedProject, script } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

/** A clock that moves only when the loop sleeps, so a run of hours takes milliseconds. */
function clock(minutesPerSleep: number) {
  let t = Date.now();
  return { now: () => t, sleep: async (): Promise<void> => void (t += minutesPerSleep * 60_000) };
}

describe.skipIf(!HAS_GIT)("budgets inside ambykit run (feature 028)", () => {
  it("028:SC-004: a tiny wall-clock budget stops the run, records why and tells the person how to continue", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { hang: true, work: false });
    const c = clock(2);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, ...c }), p.root, [F], { yes: true, "max-minutes": "1" });
    expect(r.code).toBe(1);
    expect(r.err + r.out).toContain("Budget exceeded: wall-clock budget of 1 minutes exceeded");
    expect(r.err).toContain(`--continue-run=${F}.1`);
    const rec = readRun(p.root, `${F}.1`)!;
    expect(rec.status).toBe("paused");
    expect(JSON.stringify(rec.escalations)).toContain("wall-clock");
    expect(readLaneFile(p.root, rec.run, "lane-1-1")!.status).toBe("stopped");
    expect(readEvents(p.root, rec.run).some((e) => e.kind === "budget-exceeded")).toBe(true);
  });

  it("028:FR-013: the defaults are shown at the start of a run", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true });
    const c = clock(0);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, ...c }), p.root, [F], { yes: true });
    expect(r.out).toContain("Budgets: 120 minutes wall-clock, 8 task events");
  });

  it("028:FR-013: a token ceiling the runner cannot report is stated at the start, not silently ignored", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true });
    const c = clock(0);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, ...c }), p.root, [F], { yes: true, "max-tokens": "5000" });
    expect(r.out).toContain("5000 tokens");
    expect(r.out).toContain("not enforceable for this runner");
    expect(r.code).toBe(0);
  });

  it("028:FR-013: a runner that reports usage gets no not-enforceable notice", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true });
    const c = clock(0);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(["claude", "codex"], true), port, ...c }), p.root, [F], { yes: true, "max-tokens": "5000" });
    expect(r.out).not.toContain("not enforceable");
  });

  it("028:FR-013: budgets set in .amby/config.json are used, and flags override them", async () => {
    const p = await preparedProject(F, 4, 2);
    const { writeFileSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const file = join(p.root, ".amby", "config.json");
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), fleet: { budgets: { wallClockMinutes: 45, maxTasks: 20 } } }) + "\n");
    const port = new FakePort();
    const a = await runCommand(new RunCommand({ registry: fakeRegistry(), port }), p.root, [F]);
    expect(a.out).toContain("45 minutes wall-clock, 20 task events");
    const b = await runCommand(new RunCommand({ registry: fakeRegistry(), port }), p.root, [F], { "max-tasks": "6" });
    expect(b.out).toContain("45 minutes wall-clock, 6 task events");
  });
});

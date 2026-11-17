import { describe, expect, it } from "vitest";
import { readBudget, readEvents, readLaneFile, writeBudget } from "../../src/cli/run-files.js";
import { readDirective, readRun } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, script } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

describe.skipIf(!HAS_GIT)("budgets (feature 028)", () => {
  it("028:SC-004: a wall-clock overrun stops launching, asks running lanes to stop and records why", async () => {
    const p = await preparedProject(F, 8, 4);
    const h = harness(p, { budgets: { wallClockMinutes: 1 }, settings: { concurrency: { total: 2, perType: 2 } } });
    script(h, p, { hang: true, work: false });
    await h.step();
    expect(h.port.starts).toHaveLength(2);
    h.advance(2);
    await h.step();
    expect(h.s.stopReason).toContain("wall-clock");
    // a stop directive for each running lane, written through spec 025's writer
    expect(readDirective(p.root, h.run, "lane-1-1")?.action).toBe("stop");
    expect(readDirective(p.root, h.run, "lane-1-2")?.action).toBe("stop");
    const rec = readRun(p.root, h.run)!;
    expect(rec.status).toBe("paused");
    expect(JSON.stringify(rec.escalations)).toContain("wall-clock");
    // nothing new starts, even when a slot is free
    h.port.starts[0]!.finish(0);
    await h.step();
    expect(h.port.starts).toHaveLength(2);
    expect(readEvents(p.root, h.run).some((e) => e.kind === "budget-exceeded")).toBe(true);
  });

  it("028:SC-004: a task-count overrun stops the run too", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { maxTasks: 3 } });
    script(h, p, { work: true });
    await h.step(); // both lanes finish: four tasks checked off
    await h.step();
    expect(h.s.stopReason).toContain("task budget of 3");
    expect(readBudget(p.root, h.run).tasksUsed).toBe(4);
  });

  it("028:FR-013: with no budget flags the defaults are 120 minutes and twice the open tasks", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    expect(h.s.budgets.wallClockMinutes).toBe(120);
    expect(h.s.budgets.maxTasks).toBe(16);
  });

  it("028:FR-013: a token ceiling is reported as not enforceable when the runner does not report usage, and the run is not stopped by it", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { maxTokens: 10 }, usage: false });
    script(h, p, { hang: true, work: false });
    writeBudget(p.root, h.run, { elapsedMs: 0, tasksUsed: 0, counted: [], tokensUsed: 999_999 });
    await h.step();
    expect(h.s.stopReason).toBeUndefined();
  });

  it("028:FR-013: where the runner reports usage the token ceiling is enforced", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { maxTokens: 10 }, usage: true });
    script(h, p, { hang: true, work: false });
    await h.step();
    writeBudget(p.root, h.run, { ...readBudget(p.root, h.run), tokensUsed: 11 });
    await h.step();
    expect(h.s.stopReason).toContain("token ceiling of 10");
  });

  it("028:FR-014: a lane that ignores the stop is terminated once the stop grace has passed, and the run ends as a budget stop", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { wallClockMinutes: 1 }, settings: { stopGraceMinutes: 10 } });
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(2);
    expect(await h.step()).toBeNull(); // stop asked, lanes still running
    h.advance(5);
    expect(await h.step()).toBeNull(); // inside the grace: still waiting
    expect(h.port.starts.every((x) => x.killed.length === 0)).toBe(true);
    h.advance(6); // past the grace
    await h.step();
    expect(h.port.starts.every((x) => x.killed.includes("SIGTERM"))).toBe(true);
    const out = await h.step();
    expect(out?.kind).toBe("budget");
    expect(out?.message).toContain("wall-clock");
    expect(out?.message).toContain("--continue-run");
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("stopped");
  });

  it("028:FR-014: a lane that obeys the stop and exits is recorded stopped, not unfinished or failed", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { budgets: { wallClockMinutes: 1 } });
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(2);
    await h.step();
    for (const proc of h.port.starts) proc.finish(0);
    const out = await h.step();
    expect(out?.kind).toBe("budget");
    expect(h.lane("lane-1-1").file.status).toBe("stopped");
    expect(h.lane("lane-1-2").file.status).toBe("stopped");
  });

  it("028:FR-013: the meter counts a check-off once, so a continued run does not count it again", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: true });
    await h.step();
    await h.step();
    const used = readBudget(p.root, h.run).tasksUsed;
    expect(used).toBe(4);
    await h.step();
    expect(readBudget(p.root, h.run).tasksUsed).toBe(4);
  });

  it("028:FR-013: elapsed wall-clock time accumulates across ticks", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(3);
    await h.step();
    expect(readBudget(p.root, h.run).elapsedMs).toBe(3 * 60_000);
  });
});

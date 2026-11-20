import { describe, expect, it } from "vitest";
import { feature, loop, states } from "../helpers/fleet-loop-fixture.js";
import { FakePort } from "../helpers/run-fakes.js";
import { deferredWorkers, fleetRun, gitFleetProject } from "../helpers/fleet-run-fixture.js";
import { listFleets } from "../../src/core/fleet/index.js";

const dep = (on: string) => [{ feature: on, why: "depends-on" as const }];

describe("fleet-wide budgets (feature 031, US-5)", () => {
  it("031:FR-011: the fleet stops starting work when the summed task budget is exceeded, though no feature alone exceeds it", async () => {
    const h = loop([feature("031-a"), feature("032-b"), feature("033-c", dep("031-a"))], { budgets: { maxTasks: 10 } });
    await h.sup.tick();
    for (const f of h.fakes.values()) f.usage = { elapsedMs: 0, tasksUsed: 6 };
    await h.sup.tick();
    expect(h.rec.status).toBe("paused");
    for (const f of h.fakes.values()) expect(f.stopped).toContain("task budget of 10 exceeded");
    h.fakes.get("031-a")!.finish();
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a", "032-b"]); // 033-c never starts: a stop is in force
  });

  it("031:FR-011: the stop ends with a budget outcome once every lane has exited, and names how to continue", async () => {
    const h = loop([feature("031-a")], { budgets: { maxTasks: 1 } });
    await h.sup.tick();
    const a = h.fakes.get("031-a")!;
    a.usage = { elapsedMs: 0, tasksUsed: 5 };
    a.lanes = [{ lane: "031-a.lane-1-1", assistant: "claude" }];
    a.stop = (reason) => {
      a.stopped = reason; // the lane is still running until it obeys
    };
    expect(await h.sup.tick()).toBeNull(); // asked to stop, still running
    a.lanes = [];
    const out = await h.sup.tick();
    expect(out).toMatchObject({ kind: "budget" });
    expect(out!.message).toContain("--continue-fleet=fleet-1");
  });

  it("031:FR-011: a token ceiling is enforced when the runners report usage", async () => {
    const h = loop([feature("031-a"), feature("032-b")], { budgets: { maxTokens: 1000 }, usage: true });
    await h.sup.tick();
    h.fakes.get("031-a")!.usage = { elapsedMs: 0, tasksUsed: 1, tokensUsed: 600 };
    h.fakes.get("032-b")!.usage = { elapsedMs: 0, tasksUsed: 1, tokensUsed: 600 };
    await h.sup.tick();
    expect(h.fakes.get("031-a")!.stopped).toContain("token ceiling of 1000 exceeded");
  });

  it("031:FR-011: without usage reporting the same tokens never stop the fleet", async () => {
    const h = loop([feature("031-a")], { budgets: { maxTokens: 1000 }, usage: false });
    await h.sup.tick();
    h.fakes.get("031-a")!.usage = { elapsedMs: 0, tasksUsed: 1, tokensUsed: 99999 };
    await h.sup.tick();
    expect(h.fakes.get("031-a")!.stopped).toBeUndefined();
    expect(states(h)["031-a"]).toBe("running");
  });

  it("031:FR-011: the wall-clock budget is the fleet's own elapsed time, not the sum of its features", async () => {
    const h = loop([feature("031-a"), feature("032-b")], { budgets: { wallClockMinutes: 60 } });
    await h.sup.tick();
    h.fakes.get("031-a")!.usage = { elapsedMs: 40 * 60_000, tasksUsed: 0 };
    h.fakes.get("032-b")!.usage = { elapsedMs: 40 * 60_000, tasksUsed: 0 };
    await h.sup.tick();
    expect(h.fakes.get("031-a")!.stopped).toBeUndefined(); // 40 minutes each, side by side: 40, not 80
  });

  it("031:FR-011: over real sessions, --max-tasks counts every feature's task events together and stops the fleet", async () => {
    const two = (dir: string) => ({ dir, tasks: [{ id: "T001", paths: [`src/${dir}-1.ts`] }, { id: "T002", paths: [`src/${dir}-2.ts`] }] });
    const p = gitFleetProject([two("031-a"), two("032-b")]);
    const port = new FakePort();
    const work = deferredWorkers(port, p.root);
    let n = 0;
    const sleep = async (): Promise<void> => {
      n += 1;
      if (n > 400) throw new Error("the fleet did not stop within 400 ticks");
      work.finishNext();
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude,codex", "max-tasks": "3" }, { port, deps: { sleep } });
    expect(r.code).toBe(1);
    expect(r.err).toContain("Stopped: task budget of 3 exceeded");
    expect(r.err).toContain("--continue-fleet=fleet-1");
    expect(listFleets(p.root)[0]!.status).toBe("paused");
  }, 120_000);
});

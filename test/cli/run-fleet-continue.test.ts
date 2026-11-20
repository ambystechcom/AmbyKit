import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { replan } from "../../src/cli/run-fleet.js";
import { listFleets, readRun } from "../../src/core/fleet/index.js";
import { buildFleetPlan } from "../../src/core/fleet-plan/plan.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { model } from "../helpers/fleet-plan-fixture.js";

const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }] };
const B = { dir: "032-b", dependsOn: ["031"], tasks: [{ id: "T001", paths: ["src/b1.ts"] }, { id: "T002", paths: ["src/b2.ts"] }] };

/** Run the fleet until A is done and B has started, then interrupt it (a stopped fleet). */
async function stoppedFleet() {
  const p = gitFleetProject([A, B]);
  const port = new FakePort();
  const log = scriptWorkers(port, p.root, { hold: (f) => f === "032-b" }); // B's workers never finish by themselves
  let n = 0;
  const sleep = async (): Promise<void> => {
    n += 1;
    const s = listFleets(p.root)[0]?.features;
    if ((s?.find((f) => f.feature === "031-a")?.state === "done" && s.find((f) => f.feature === "032-b")?.state === "running" && port.starts.some((h) => h.alive())) || n > 300) process.emit("SIGINT");
  };
  const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
  return { p, r, log };
}

describe("stop a fleet, inspect it and resume it later (feature 031, US-8)", () => {
  it("031:FR-017: a stopped fleet resumes without repeating a completed feature's lanes", async () => {
    const { p, r, log } = await stoppedFleet();
    expect(r.code, r.err).toBe(0);
    expect(r.out + r.err).toContain("--continue-fleet=fleet-1");
    const aSpawnsBefore = log.spawns.filter((f) => f === "031-a").length;
    expect(aSpawnsBefore).toBeGreaterThan(0);
    const before = listFleets(p.root)[0]!;
    expect(before.status).toBe("paused");
    expect(before.features.map((f) => [f.feature, f.state])).toEqual([["031-a", "done"], ["032-b", "running"]]);

    const port2 = new FakePort();
    const log2 = scriptWorkers(port2, p.root); // B's workers finish normally now
    let n = 0;
    const sleep = async (): Promise<void> => void (++n > 300 && (() => { throw new Error("the fleet did not finish within 300 ticks"); })());
    const again = await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-1" }, { port: port2, deps: { sleep } });
    expect(again.code, again.err + again.out).toBe(0);
    expect(log2.spawns).not.toContain("031-a"); // no completed lane ran again
    expect(log2.spawns).toContain("032-b");
    const after = listFleets(p.root)[0]!;
    expect(after.status).toBe("done");
    expect(after.features.map((f) => f.state)).toEqual(["done", "done"]);
    expect(readRun(p.root, "032-b.1")!.status).toBe("done"); // the same run continued, not a new one
    expect(existsSync(join(p.roots["032-b"]!, "src", "031-a.lane-1-1.ts"))).toBe(true);
  }, 180_000);

  it("031:FR-017: a fleet that has nothing left says so", async () => {
    const { p } = await stoppedFleet();
    const port2 = new FakePort();
    scriptWorkers(port2, p.root);
    await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-1" }, { port: port2, deps: { sleep: async () => undefined } });
    const done = await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-1" }, { port: new FakePort() });
    expect(done.code).toBe(0);
    expect(done.out).toContain("Fleet fleet-1 has nothing left to run.");
  }, 180_000);

  it("031:FR-017: an unknown fleet id is an error", async () => {
    const p = gitFleetProject([A]);
    const r = await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-7" });
    expect(r.code).toBe(1);
    expect(r.err).toContain("Fleet 'fleet-7' not found");
  });

  it("031:FR-018: a task list edited after planning is re-planned on resume, and the change is reported", async () => {
    const { p } = await stoppedFleet();
    const file = join(p.root, "specs", "032-b", "tasks.md");
    appendFileSync(file, "- [ ] [T003] [P] [US1] a task added after planning (src/b3.ts)\n");
    writeFileSync(file, readFileSync(file, "utf8"));
    const port2 = new FakePort();
    scriptWorkers(port2, p.root);
    const r = await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-1" }, { port: port2, deps: { sleep: async () => undefined } });
    expect(r.out).toContain("Re-planned fleet-1; changed since it was planned: 032-b (tasks or dependencies edited).");
  }, 180_000);

  it("031:FR-018: with nothing edited, resuming says nothing changed", async () => {
    const { p } = await stoppedFleet();
    const r = await fleetRun(p.root, [], { yes: true, assistant: "claude", "continue-fleet": "fleet-1" }, { port: new FakePort(), deps: { sleep: async () => { process.emit("SIGINT"); } } });
    expect(r.out).toContain("Continuing fleet-1: nothing changed since it was planned.");
  }, 180_000);

  it("031:FR-018: replan reports exactly the features whose fingerprint differs and keeps their progress", () => {
    const planFor = (defs: Parameters<typeof model>[0][]) => {
      const r = buildFleetPlan({ args: defs.map((d) => d.dir), models: defs.map(model), deps: [], done: new Set(), caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 10 } });
      if (!r.ok) throw new Error("x");
      return r.value;
    };
    const first = planFor([{ dir: "031-a" }, { dir: "032-b" }]);
    const record = { fleet: "fleet-1", status: "active" as const, createdAt: "t", features: first.features.map((f) => ({ ...f, state: "running" as const, run: `${f.feature}.1` })), caps: first.caps, budgets: first.budgets, unattended: false };
    const second = planFor([{ dir: "031-a" }, { dir: "032-b", tasks: [{ id: "T001", paths: ["src/other.ts"] }] }]);
    expect(replan(record, second)).toEqual(["032-b (tasks or dependencies edited)"]);
    expect(record.features.map((f) => [f.state, f.run])).toEqual([["running", "031-a.1"], ["running", "032-b.1"]]);
  });
});

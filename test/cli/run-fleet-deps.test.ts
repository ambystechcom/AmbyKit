import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fleetRoot, listFleets, listRuns } from "../../src/core/fleet/index.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";

const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }, { id: "T002", paths: ["src/a2.ts"] }] };
const B = { dir: "032-b", dependsOn: ["031"], tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };

async function ticksGuard(): Promise<{ sleep: () => Promise<void>; count: () => number }> {
  let n = 0;
  return {
    sleep: async () => {
      n += 1;
      if (n > 400) throw new Error("the fleet did not finish within 400 ticks");
    },
    count: () => n,
  };
}

describe("a dependent feature waits for the one it depends on, end to end (feature 031, US-3)", () => {
  it("031:FR-007: B does not start until every lane of A has merged; then B builds on A's merged work", async () => {
    const p = gitFleetProject([A, B]);
    const port = new FakePort();
    const log = scriptWorkers(port, p.root);
    const g = await ticksGuard();
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude,codex" }, { port, deps: { sleep: g.sleep } });
    expect(r.code, r.err + r.out).toBe(0);

    const firstB = log.spawns.indexOf("032-b");
    const lastA = log.spawns.lastIndexOf("031-a");
    expect(firstB).toBeGreaterThan(-1);
    expect(lastA).toBeGreaterThan(-1);
    expect(firstB).toBeGreaterThan(lastA); // no process of B before every process of A has run

    // B's checkout has A's merged work, and the fleet is done with each run nested in the fleet directory
    expect(existsSync(join(p.roots["032-b"]!, "src", "031-a.lane-1-1.ts"))).toBe(true);
    const [fleet] = listFleets(p.root);
    expect(fleet!.status).toBe("done");
    expect(fleet!.features.map((f) => [f.feature, f.state, f.run])).toEqual([["031-a", "done", "031-a.1"], ["032-b", "done", "032-b.1"]]);
    expect(existsSync(join(fleetRoot(p.root), "fleet-1", "031-a.1", "run.json"))).toBe(true);
    expect(listRuns(p.root).map((x) => [x.run, x.status])).toEqual([["031-a.1", "done"], ["032-b.1", "done"]]);
    expect(readFileSync(join(p.roots["032-b"]!, "specs", "032-b", "tasks.md"), "utf8")).toContain("- [x] [T001]");
  }, 120_000);

  it("031:FR-007: a chain A, B, C starts in dependency order", async () => {
    const C = { dir: "033-c", dependsOn: ["032"], tasks: [{ id: "T001", paths: ["src/c1.ts"] }] };
    const p = gitFleetProject([C, B, A]);
    const port = new FakePort();
    const log = scriptWorkers(port, p.root);
    const g = await ticksGuard();
    const r = await fleetRun(p.root, ["033", "032", "031"], { yes: true, assistant: "claude" }, { port, deps: { sleep: g.sleep } });
    expect(r.code, r.err).toBe(0);
    const first = (f: string): number => log.spawns.indexOf(f);
    const last = (f: string): number => log.spawns.lastIndexOf(f);
    expect(last("031-a")).toBeLessThan(first("032-b"));
    expect(last("032-b")).toBeLessThan(first("033-c"));
  }, 120_000);

  it("031:FR-021: in a fleet the same prompt names the nested path, where the supervisor reads it", async () => {
    const p = gitFleetProject([A, B]);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    const g = await ticksGuard();
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep: g.sleep } });
    expect(r.code, r.err).toBe(0);
    const nested = readFileSync(join(fleetRoot(p.root), "fleet-1", "031-a.1", "prompts", "lane-1-1.qa.1.md"), "utf8");
    expect(nested).toContain("Write your verdict to .amby/fleet/fleet-1/031-a.1/verdicts/");
    expect(existsSync(join(fleetRoot(p.root), "031-a.1"))).toBe(false); // nothing was written to a flat run directory
  }, 120_000);

  it("031:FR-008: a dependency on a feature outside the fleet that is not done stops before anything starts", async () => {
    const p = gitFleetProject([A, B, { dir: "033-c", tasks: [{ id: "T001", paths: ["src/c1.ts"] }] }]);
    const port = new FakePort();
    const r = await fleetRun(p.root, ["032", "033"], { yes: true, assistant: "claude" }, { port });
    expect(r.code).toBe(1);
    expect(r.err).toContain("032-b depends on 031-a, which is not in the fleet and not done");
    expect(listFleets(p.root)).toEqual([]);
    expect(port.starts).toHaveLength(0);
  }, 120_000);
});

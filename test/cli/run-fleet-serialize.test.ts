import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFleetPlan } from "../../src/core/fleet-plan/plan.js";
import { listFleets } from "../../src/core/fleet/index.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { loop, states } from "../helpers/fleet-loop-fixture.js";
import { model, type FeatureDef } from "../helpers/fleet-plan-fixture.js";

const own = (dir: string, ...files: string[]): FeatureDef => ({ dir, tasks: files.map((p, i) => ({ id: `T00${i + 1}`, paths: [p] })) });

function planned(defs: FeatureDef[]) {
  const r = buildFleetPlan({ args: defs.map((d) => d.dir), models: defs.map(model), deps: [], done: new Set(), caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 50 } });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

describe("features that share files run one after the other (feature 031, US-2)", () => {
  it("031:FR-004: two features that own the same file are never running at the same time, in every tick", async () => {
    const defs = [own("031-a", "src/x.ts"), own("032-b", "src/x.ts", "src/y.ts"), own("033-c", "src/y.ts"), own("034-d", "src/z.ts")];
    const plan = planned(defs);
    const h = loop(plan.features);
    const owner = new Map(plan.features.map((f) => [f.feature, f.ownership.files]));
    const clash = (a: string, b: string): boolean => owner.get(a)!.some((f) => owner.get(b)!.includes(f));
    for (let tick = 0; tick < 12; tick++) {
      const out = await h.sup.tick();
      const running = h.rec.features.filter((f) => f.state === "running").map((f) => f.feature);
      for (const a of running) for (const b of running) if (a < b) expect(clash(a, b), `${a} and ${b} overlap but both run (tick ${tick})`).toBe(false);
      if (out) break;
      const first = h.rec.features.find((f) => f.state === "running");
      if (first) h.fakes.get(first.feature)!.finish();
    }
    expect(Object.values(states(h)).every((s) => s === "done")).toBe(true);
    // the overlapping ones went in number order
    expect(h.begun.indexOf("031-a")).toBeLessThan(h.begun.indexOf("032-b"));
    expect(h.begun.indexOf("032-b")).toBeLessThan(h.begun.indexOf("033-c"));
  });

  it("031:FR-004: features with no shared file start together", async () => {
    const h = loop(planned([own("031-a", "src/a.ts"), own("032-b", "src/b.ts")]).features);
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a", "032-b"]);
  });

  it("031:FR-004: the second feature starts after the first has merged and works from the merged result (real git)", async () => {
    const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/shared.ts"] }] };
    const C = { dir: "033-c", tasks: [{ id: "T001", paths: ["src/shared.ts"] }] };
    const p = gitFleetProject([A, C]);
    const port = new FakePort();
    const log = scriptWorkers(port, p.root);
    let n = 0;
    const sleep = async (): Promise<void> => {
      n += 1;
      if (n > 400) throw new Error("the fleet did not finish within 400 ticks");
    };
    const r = await fleetRun(p.root, ["031", "033"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
    expect(r.code, r.err).toBe(0);
    expect(log.spawns.lastIndexOf("031-a")).toBeLessThan(log.spawns.indexOf("033-c"));
    expect(existsSync(join(p.roots["033-c"]!, "src", "031-a.lane-1-1.ts"))).toBe(true); // C started from A's merged result
    expect(listFleets(p.root)[0]!.features.find((f) => f.feature === "033-c")!.waitsFor).toEqual([{ feature: "031-a", why: "shared-files", files: ["src/shared.ts"] }]);
    expect(readFileSync(join(p.roots["033-c"]!, "specs", "033-c", "tasks.md"), "utf8")).toContain("- [x] [T001]");
  }, 120_000);
});

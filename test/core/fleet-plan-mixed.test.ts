import { describe, expect, it } from "vitest";
import { buildFleetPlan } from "../../src/core/fleet-plan/plan.js";
import { readFleetInput } from "../../src/core/fleet-plan/read.js";
import { fleetProject, type FeatureDef } from "../helpers/fleet-plan-fixture.js";

const TASKS = { tasks: [{ id: "T001", paths: ["src/shared.ts"] }, { id: "T002", paths: ["src/own.ts"] }] };

function plan(root: string, args: string[]) {
  const input = readFleetInput(root);
  const r = buildFleetPlan({ args, models: input.models, deps: input.deps, done: input.done, caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 50 } });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value.features.map((f) => ({ feature: f.feature, ownership: f.ownership, waitsFor: f.waitsFor.map((w) => `${w.feature}:${w.why}`) }));
}

const v1 = (dir: string, extra: Partial<FeatureDef> = {}): FeatureDef => ({ dir, ...TASKS, ...extra });
const v2 = (dir: string, extra: Partial<FeatureDef> = {}): FeatureDef => ({ dir, ...TASKS, dependsOn: [], ...extra });

describe("a fleet reads 1.x, 2.x and mixed features the same way (feature 031, FR-022)", () => {
  it("031:FR-020: the same ownership gives the same plan whether the specs are 1.x or 2.x", () => {
    const old = plan(fleetProject([v1("031-a"), v1("032-b")]), ["031", "032"]);
    const next = plan(fleetProject([v2("031-a"), v2("032-b")]), ["031", "032"]);
    expect(next).toEqual(old);
    expect(old[1]!.waitsFor).toEqual(["031-a:shared-files"]);
  });

  it("031:FR-020: a mixed fleet (one 1.x, one 2.x feature) serializes on shared files exactly the same", () => {
    const mixed = plan(fleetProject([v1("031-a"), v2("032-b")]), ["031", "032"]);
    expect(mixed.map((f) => f.ownership.files)).toEqual([["src/own.ts", "src/shared.ts"], ["src/own.ts", "src/shared.ts"]]);
    expect(mixed[1]!.waitsFor).toEqual(["031-a:shared-files"]);
  });

  it("031:FR-007: a 1.x story edge and a 2.x feature-level depends-on both make the dependent wait", () => {
    const a = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a.ts"] }] };
    const edge = plan(fleetProject([a, { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b.ts"] }], storyDependsOn: ["031:US-1"] }]), ["031", "032"]);
    const declared = plan(fleetProject([a, { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b.ts"] }], dependsOn: ["031"] }]), ["031", "032"]);
    expect(edge[1]!.waitsFor).toEqual(["031-a:story-edge"]);
    expect(declared[1]!.waitsFor).toEqual(["031-a:depends-on"]);
    expect(edge.map((f) => f.feature)).toEqual(declared.map((f) => f.feature));
  });

  it("031:FR-006: missing ownership is flagged the same way in both formats", () => {
    const task = { tasks: [{ id: "T001", paths: null }] };
    const a = plan(fleetProject([{ dir: "031-a", ...task }, { dir: "032-b", ...task }]), ["031", "032"]);
    const b = plan(fleetProject([{ dir: "031-a", dependsOn: [], ...task }, { dir: "032-b", dependsOn: [], ...task }]), ["031", "032"]);
    expect(b).toEqual(a);
    expect(a[0]!.ownership.unknown).toEqual(["T001"]);
  });
});

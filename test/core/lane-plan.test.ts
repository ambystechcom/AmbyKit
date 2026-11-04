import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { planLanes } from "../../src/core/lanes.js";
import { phase, tasksMd, type PhaseDef, type TaskDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const plan = (phases: PhaseDef[], opts?: { phase?: number; lanes?: number }) =>
  planLanes(F, parseTasks(tasksMd(phases)), opts);
const par = (n: number, extra: Partial<TaskDef> = {}): TaskDef => ({
  id: `T00${n}`,
  parallel: true,
  paths: [`src/f${n}.ts`],
  ...extra,
});

describe("planLanes", () => {
  it("deals 5 [P] tasks round-robin into 2 lanes, with sequential tasks staying", () => {
    const p = plan([phase(3, [par(1), par(2), par(3), par(4), par(5), { id: "T009", paths: ["src/z.ts"] }])]);
    expect(p.status).toBe("planned");
    expect(p.phase).toBe(3);
    expect(p.lanes.map((l) => [l.name, l.tasks.map((t) => t.id)])).toEqual([
      [`${F}.lane-3-1`, ["T001", "T003", "T005"]],
      [`${F}.lane-3-2`, ["T002", "T004"]],
    ]);
    expect(p.stays).toEqual(["T009"]);
  });

  it("clamps lanes to the number of [P] tasks", () => {
    const p = plan([phase(1, [par(1), par(2)])], { lanes: 9 });
    expect(p.lanes).toHaveLength(2);
  });

  it("defaults to the first phase with open [P] tasks and honors --phase", () => {
    const phases = [phase(1, [par(1, { done: true })]), phase(2, [par(2)]), phase(3, [par(3)])];
    expect(plan(phases).phase).toBe(2);
    expect(plan(phases, { phase: 3 }).lanes[0]!.tasks[0]!.id).toBe("T003");
  });

  it("reports complete when every [P] task is done, and no-parallel when there are none", () => {
    expect(plan([phase(1, [par(1, { done: true })])]).status).toBe("complete");
    expect(plan([phase(1, [{ id: "T001", paths: ["a.ts"] }])]).status).toBe("no-parallel");
  });

  it("refuses with the conflicts when the phase has any", () => {
    const p = plan([phase(1, [par(1, { paths: ["src/a.ts"] }), par(2, { paths: ["src/a.ts"] })])]);
    expect(p.status).toBe("conflict");
    expect(p.lanes).toEqual([]);
    expect(p.conflicts[0]!.tasks).toEqual(["T001", "T002"]);
  });

  it("produces pairwise path-disjoint lanes", () => {
    const p = plan([phase(1, [par(1), par(2), par(3), par(4)])], { lanes: 3 });
    const all = p.lanes.flatMap((l) => l.tasks.flatMap((t) => t.paths));
    expect(new Set(all).size).toBe(all.length);
  });
});

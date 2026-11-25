import { describe, expect, it } from "vitest";
import { prepareLanes, type LaneRunner } from "../../src/cli/run-fleet-prepare.js";
import { LaneCommand } from "../../src/cli/lane.js";
import { laneRefs } from "../../src/core/query.js";
import { laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd } from "../helpers/tasks-fixture.js";

describe("fleet lane preparation (feature 031, clarification C-2)", () => {
  it("031:FR-001: missing lanes are prepared with the lane command, with the requested lane count", async () => {
    const tasks = [1, 2, 3, 4].map((n) => ({ id: `T00${n}`, parallel: true, paths: [`src/f${n}.ts`] }));
    const p = laneProject("031-a", tasksMd([phase(1, tasks)], { feature: "031-a" }));
    const out = await prepareLanes(p.root, [{ feature: "031-a", lanes: 2 }]);
    expect(out).toEqual([{ feature: "031-a", ok: true }]);
    expect(laneRefs(p.root, "031-a")).toHaveLength(2);
  });

  it("031:FR-001: a failed preparation refuses with the exact `ambykit lane` command to run by hand", async () => {
    const calls: string[][] = [];
    const run: LaneRunner = async (_cwd, positionals) => {
      calls.push(positionals);
      return { code: 1, err: "No branch for 031-a — create it with `ambykit worktree 031-a` first." };
    };
    const out = await prepareLanes("/nowhere", [{ feature: "031-a", lanes: 2 }, { feature: "032-b", lanes: 3 }], run);
    expect(calls).toEqual([["031-a"], ["032-b"]]);
    expect(out[0]).toMatchObject({ ok: false });
    expect(out[0]!.reason).toContain("No branch for 031-a");
    expect(out[0]!.reason).toContain("ambykit lane 031-a --next --lanes=2");
  });

  it("031:FR-001: preparing is idempotent: lanes that exist are not created twice", async () => {
    const p = laneProject("031-a", tasksMd([phase(1, [{ id: "T001", parallel: true, paths: ["src/a.ts"] }])], { feature: "031-a" }));
    await runCommand(new LaneCommand(), p.root, ["031-a"], { lanes: "1" });
    const out = await prepareLanes(p.root, [{ feature: "031-a", lanes: 1 }]);
    expect(out[0]!.ok).toBe(true);
    expect(laneRefs(p.root, "031-a")).toHaveLength(1);
  });
});

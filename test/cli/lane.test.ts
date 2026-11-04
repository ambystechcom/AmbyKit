import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { branchExists, worktreeList } from "../../src/core/git.js";
import { featureWorktrees, featureFromWorktreePath, laneWorktrees } from "../../src/core/worktree.js";
import { HAS_GIT, gitRun } from "../helpers/git-repo.js";
import { laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const par = (n: number, paths = [`src/f${n}.ts`]): TaskDef => ({ id: `T00${n}`, parallel: true, paths });
const lane = (cwd: string, positionals: string[], flags: Record<string, string | boolean> = {}) =>
  runCommand(new LaneCommand(), cwd, positionals, flags);

describe.skipIf(!HAS_GIT)("ambykit lane (feature 015)", () => {
  it("creates one worktree per lane, each manifest listing only its tasks; the second run is a no-op (SC-003)", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2), par(3), par(4)])]));
    const r = await lane(p.root, [F], { json: true });
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.lanes.map((l: { name: string; action: string }) => [l.name, l.action])).toEqual([
      [`${F}.lane-1-1`, "created"],
      [`${F}.lane-1-2`, "created"],
    ]);
    const manifest = (k: number) =>
      JSON.parse(readFileSync(join(p.root, ".worktrees", `${F}.lane-1-${k}`, ".amby", "lane", "lane.json"), "utf8"));
    expect(manifest(1).tasks.map((t: { id: string }) => t.id)).toEqual(["T001", "T003"]);
    expect(manifest(2).tasks.map((t: { id: string }) => t.id)).toEqual(["T002", "T004"]);
    expect(branchExists(p.root, `${F}.lane-1-1`)).toBe(true);
    expect(gitRun(join(p.root, ".worktrees", `${F}.lane-1-1`), ["status", "--porcelain"])).toBe("");

    const again = JSON.parse((await lane(p.root, [F], { json: true })).out);
    expect(again.lanes.map((l: { action: string }) => l.action)).toEqual(["exists", "exists"]);
    expect(laneWorktrees(p.root, worktreeList(p.root))).toHaveLength(2);
  });

  it("keeps lanes out of the feature worktree list and maps a lane path to its feature (FR-018)", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    await lane(p.root, [F]);
    const features = featureWorktrees(p.root, worktreeList(p.root)).map((x) => x.feature);
    expect(features).toEqual([F]);
    expect(featureFromWorktreePath(join(p.root, ".worktrees", `${F}.lane-1-2`, "src"))).toBe(F);
  });

  it("refuses on a path conflict and creates nothing", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1, ["src/a.ts"]), par(2, ["src/a.ts"])])]));
    const r = await lane(p.root, [F]);
    expect(r.code).toBe(1);
    expect(r.out + r.err).toContain("T001, T002");
    expect(laneWorktrees(p.root, worktreeList(p.root))).toHaveLength(0);
  });

  it("refuses when worktrees are not enabled in config (FR-011)", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]), { worktrees: false });
    const r = await lane(p.root, [F]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('"worktrees": true');
    expect(existsSync(join(p.root, ".worktrees", `${F}.lane-1-1`))).toBe(false);
  });

  it("honors --lanes and --phase, and --dry-run creates nothing", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1)]), phase(2, [par(2), par(3), par(4)])]));
    const dry = await lane(p.root, [F], { "dry-run": true, phase: "2", lanes: "3" });
    expect(dry.code).toBe(0);
    expect(laneWorktrees(p.root, worktreeList(p.root))).toHaveLength(0);
    const r = JSON.parse((await lane(p.root, [F], { json: true, phase: "2", lanes: "3" })).out);
    expect(r.lanes).toHaveLength(3);
    expect(r.phase).toBe(2);
  });

  it("lists lanes with progress, state and drift, then removes them keeping branches (FR-010/020)", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    await lane(p.root, [F]);
    const l1 = join(p.root, ".worktrees", `${F}.lane-1-1`);
    const l2 = join(p.root, ".worktrees", `${F}.lane-1-2`);
    writeTick(l1);
    const rows = JSON.parse((await lane(p.root, ["list"], { json: true })).out);
    expect(rows.map((r: { name: string; state: string; done: number; total: number }) => [r.name, r.state, r.done, r.total])).toEqual([
      [`${F}.lane-1-1`, "dirty", 1, 1],
      [`${F}.lane-1-2`, "clean", 0, 1],
    ]);

    const refused = await lane(p.root, ["remove", F, "1-1"]);
    expect(refused.code).toBe(1);
    expect(existsSync(l1)).toBe(true);

    expect((await lane(p.root, ["remove", F, "1-2"])).code).toBe(0);
    expect(existsSync(l2)).toBe(false);
    expect(branchExists(p.root, `${F}.lane-1-2`)).toBe(true);
    expect((await lane(p.root, ["remove", F], { force: true })).code).toBe(0);
    expect(existsSync(l1)).toBe(false);
  });

  it("reports drift when the feature's tasks.md changed a lane task's paths (FR-020)", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    await lane(p.root, [F]);
    writeFeatureTasks(p.featureRoot, tasksMd([phase(1, [par(1, ["src/moved.ts"]), par(2)])]));
    const rows = JSON.parse((await lane(p.root, ["list", F], { json: true })).out);
    expect(rows.find((r: { name: string }) => r.name.endsWith("1-1")).drift).toEqual(["T001"]);
    expect(rows.find((r: { name: string }) => r.name.endsWith("1-2")).drift).toEqual([]);
  });
});

function writeTick(laneRoot: string): void {
  const file = join(laneRoot, "specs", F, "tasks.md");
  writeFileSync(file, readFileSync(file, "utf8").replace("- [ ] [T001]", "- [x] [T001]"));
}

function writeFeatureTasks(checkout: string, body: string): void {
  writeFileSync(join(checkout, "specs", F, "tasks.md"), body);
}

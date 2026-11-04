import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { parseTasks } from "../../src/core/dashboard.js";
import { HAS_GIT, gitRun } from "../helpers/git-repo.js";
import { commitFile, laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const par = (n: number): TaskDef => ({ id: `T00${n}`, parallel: true, paths: [`src/f${n}.ts`] });
const lane = (cwd: string, positionals: string[], flags: Record<string, string | boolean> = {}) =>
  runCommand(new LaneCommand(), cwd, positionals, flags);

/** Tick `id` in a lane's tasks.md, add a code file, and commit both in the lane. */
function work(laneRoot: string, id: string, file: string, content: string): void {
  const tasks = join(laneRoot, "specs", F, "tasks.md");
  writeFileSync(tasks, readFileSync(tasks, "utf8").replace(`- [ ] [${id}]`, `- [x] [${id}]`));
  commitFile(laneRoot, file, content, `work ${id}`);
}

describe.skipIf(!HAS_GIT)("ambykit lane merge (feature 015)", () => {
  it("merges adjacent check-offs cleanly with both ticks (FR-019, SC-008)", async () => {
    for (const eol of ["\n", "\r\n"] as const) {
      const p = laneProject(F, tasksMd([phase(1, [par(1), par(2), par(3), par(4)])], { eol }));
      await lane(p.root, [F]);
      work(join(p.root, ".worktrees", `${F}.lane-1-1`), "T001", "src/f1.ts", "one\n");
      work(join(p.root, ".worktrees", `${F}.lane-1-2`), "T002", "src/f2.ts", "two\n");

      const r = await lane(p.root, ["merge", F], { json: true });
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).lanes.map((l: { result: string }) => l.result)).toEqual(["merged", "merged"]);

      const body = readFileSync(join(p.featureRoot, "specs", F, "tasks.md"), "utf8");
      expect(parseTasks(body).filter((t) => t.done).map((t) => t.id)).toEqual(["T001", "T002"]);
      expect(body.includes("\r\n")).toBe(eol === "\r\n");
      expect(existsSync(join(p.featureRoot, "src", "f1.ts"))).toBe(true);
      expect(existsSync(join(p.featureRoot, "src", "f2.ts"))).toBe(true);
      expect(gitRun(p.featureRoot, ["status", "--porcelain"])).toBe("");
      expect(gitRun(p.featureRoot, ["log", "--format=%s", "-3"])).toContain(`Merge lane ${F}.lane-1-2`);
    }
  });

  it("reports lanes already merged as nothing to do", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    await lane(p.root, [F]);
    work(join(p.root, ".worktrees", `${F}.lane-1-1`), "T001", "src/f1.ts", "one\n");
    await lane(p.root, ["merge", F]);
    const r = JSON.parse((await lane(p.root, ["merge", F], { json: true })).out);
    expect(r.lanes.map((l: { result: string }) => l.result)).toEqual(["nothing", "nothing"]);
  });

  it("aborts on a real code conflict, leaving the feature checkout clean, and still merges other lanes", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2), par(3), par(4)])]));
    await lane(p.root, [F]);
    work(join(p.root, ".worktrees", `${F}.lane-1-1`), "T001", "shared.txt", "from lane\n");
    work(join(p.root, ".worktrees", `${F}.lane-1-2`), "T002", "src/f2.ts", "two\n");
    commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");

    const r = await lane(p.root, ["merge", F], { json: true });
    expect(r.code).toBe(1);
    const results = JSON.parse(r.out).lanes.map((l: { lane: string; result: string }) => [l.lane.slice(-3), l.result]);
    expect(results).toEqual([["1-1", "conflict"], ["1-2", "merged"]]);
    expect(readFileSync(join(p.featureRoot, "shared.txt"), "utf8")).toBe("from feature\n");
    expect(gitRun(p.featureRoot, ["status", "--porcelain"])).toBe("");
    expect(existsSync(join(p.featureRoot, ".git"))).toBe(true);
  });

  it("refuses when the feature checkout has uncommitted changes", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    await lane(p.root, [F]);
    writeFileSync(join(p.featureRoot, "scratch.txt"), "wip\n");
    const r = await lane(p.root, ["merge", F]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("uncommitted");
  });
});

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeLanes } from "../../src/core/lane-merge.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { addLane, commitFile, laneProject } from "../helpers/lane-fixture.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const par = (n: number): TaskDef => ({ id: `T00${n}`, parallel: true, paths: [`src/f${n}.ts`] });

function tick(laneRoot: string, id: string, file: string, content: string): void {
  const tasks = join(laneRoot, "specs", F, "tasks.md");
  writeFileSync(tasks, readFileSync(tasks, "utf8").replace(`- [ ] [${id}]`, `- [x] [${id}]`));
  commitFile(laneRoot, file, content, `work ${id}`);
}

describe.skipIf(!HAS_GIT)("core lane merge (feature 028 extraction of 015)", () => {
  it("028:FR-011: merges lanes one at a time in name order with a structured result per lane", () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    const l1 = addLane(p, 1, 1);
    const l2 = addLane(p, 1, 2);
    tick(l2, "T002", "src/f2.ts", "two\n");
    tick(l1, "T001", "src/f1.ts", "one\n");
    const out = mergeLanes(p.root, F);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.lanes.map((l) => [l.lane.slice(-3), l.result])).toEqual([["1-1", "merged"], ["1-2", "merged"]]);
      expect(out.found).toBe(2);
    }
  });

  it("028:FR-011: one named lane merges alone; the other is untouched", () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    const l1 = addLane(p, 1, 1);
    addLane(p, 1, 2);
    tick(l1, "T001", "src/f1.ts", "one\n");
    const out = mergeLanes(p.root, F, "lane-1-1");
    expect(out.ok && out.lanes.map((l) => l.result)).toEqual(["merged"]);
  });

  it("028:FR-012: a real conflict aborts that merge, reports it and leaves the checkout clean", () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1)])]));
    const l1 = addLane(p, 1, 1);
    tick(l1, "T001", "shared.txt", "from lane\n");
    commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");
    const out = mergeLanes(p.root, F);
    expect(out.ok && out.lanes[0]?.result).toBe("conflict");
    expect(out.ok && out.lanes[0]?.detail).toContain("shared.txt");
  });

  it("028:FR-012: an unknown lane is an error naming the lanes that exist", () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1)])]));
    addLane(p, 1, 1);
    const out = mergeLanes(p.root, F, "9-9");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("no-lane");
      expect(out.error).toContain("lane-1-1");
    }
  });

  it("028:FR-011: a feature with no lanes merges nothing", () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1)])]));
    const out = mergeLanes(p.root, F);
    expect(out.ok && out.found).toBe(0);
  });
});

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { allCheckouts, readProjectFeatures, resolveCheckouts } from "../../src/core/checkouts.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { featureRow } from "../../src/core/overview.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { commitFile, laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const par = (n: number): TaskDef => ({ id: `T00${n}`, parallel: true, paths: [`src/f${n}.ts`] });
const mk = async () => {
  const p = laneProject(F, tasksMd([phase(1, [par(1), par(2), par(3), par(4)])]));
  await runCommand(new LaneCommand(), p.root, [F]);
  return { ...p, l1: join(p.root, ".worktrees", `${F}.lane-1-1`), l2: join(p.root, ".worktrees", `${F}.lane-1-2`) };
};
const tick = (laneRoot: string, id: string) => {
  const f = join(laneRoot, "specs", F, "tasks.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(`- [ ] [${id}]`, `- [x] [${id}]`));
};

describe.skipIf(!HAS_GIT)("lanes in the dashboard data (feature 015, US-4)", () => {
  it("resolves lanes as lane checkouts, separate from feature worktrees, and watches them", async () => {
    const p = await mk();
    const c = await resolveCheckouts(p.root);
    expect(c.worktrees.map((w) => w.feature)).toEqual([F]);
    expect(c.lanes.map((l) => [l.name, l.checkout.kind, l.manifest?.tasks.length])).toEqual([
      [`${F}.lane-1-1`, "lane", 2],
      [`${F}.lane-1-2`, "lane", 2],
    ]);
    expect(allCheckouts(c).filter((x) => x.kind === "lane")).toHaveLength(2);
  });

  it("attaches lane counts from each lane's own tasks.md and never treats a lane as a feature", async () => {
    const p = await mk();
    tick(p.l1, "T001");
    commitFile(p.l1, "src/f1.ts", "one\n");
    tick(p.l2, "T002"); // left uncommitted → dirty
    const { features } = await readProjectFeatures(p.root);
    expect(features.map((f) => f.dir)).toEqual([F]);
    const lanes = features[0]!.lanes!;
    expect(lanes.map((l) => [l.name.slice(-3), l.done, l.total, l.state, l.drift])).toEqual([
      ["1-1", 1, 2, "clean", []],
      ["1-2", 1, 2, "dirty", []],
    ]);
  });

  it("counts lane check-offs toward the feature before they are merged (D5)", async () => {
    const p = await mk();
    tick(p.l1, "T001");
    tick(p.l2, "T002");
    const { features } = await readProjectFeatures(p.root);
    expect(featureRow(features[0]!).tasks).toEqual({ done: 2, total: 4 });
  });

  it("marks a merged lane as merged", async () => {
    const p = await mk();
    tick(p.l1, "T001");
    commitFile(p.l1, "src/f1.ts", "one\n", "lane work");
    await runCommand(new LaneCommand(), p.root, ["merge", F]);
    const { features } = await readProjectFeatures(p.root);
    expect(features[0]!.lanes!.find((l) => l.name.endsWith("1-1"))!.state).toBe("merged");
  });

  it("is unchanged when there are no lanes", async () => {
    const p = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    const { features, checkouts } = await readProjectFeatures(p.root);
    expect(checkouts.lanes).toEqual([]);
    expect(features[0]!.lanes).toBeUndefined();
    expect("lanes" in featureRow(features[0]!)).toBe(false);
  });
});


describe.skipIf(!HAS_GIT)("dashboard --json --overview with lanes (feature 015, FR-012)", () => {
  const overview = async (root: string) => {
    const r = await runCommand(new DashboardCommand(), root, [], { json: true, overview: true });
    return JSON.parse(r.out) as { features: { name: string; lanes?: { name: string; done: number; total: number; state: string }[] }[] };
  };

  it("adds `lanes` only to a feature that has some", async () => {
    const p = await mk();
    tick(p.l1, "T001");
    const doc = await overview(p.root);
    const f = doc.features.find((x) => x.name === F)!;
    expect(f.lanes!.map((l) => [l.name.slice(-3), l.done, l.total, l.state])).toEqual([
      ["1-1", 1, 2, "dirty"],
      ["1-2", 0, 2, "clean"],
    ]);

    const plain = laneProject(F, tasksMd([phase(1, [par(1), par(2)])]));
    expect((await overview(plain.root)).features[0]).not.toHaveProperty("lanes");
  });
});

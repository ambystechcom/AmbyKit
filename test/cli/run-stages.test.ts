import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { laneProject, type LaneProject } from "../helpers/lane-fixture.js";
import { harness, readLaneFile, script, type Harness } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd } from "../helpers/tasks-fixture.js";
import { HAS_GIT } from "../helpers/git-repo.js";

/**
 * The 2.0 dogfood: `ambykit run 037 038` laned only 037's Phase 2 `[P]` tasks, so Phase 1 (T001, T002) and T010 never
 * ran and the tests of Phase 2 were written against code that did not exist. Owner decision: run executes the
 * sequential tasks too, in order. A stage is prepared only after the previous one merged.
 */

const F = "037-adr-citation-severity";

async function project(): Promise<LaneProject> {
  const p = laneProject(
    F,
    tasksMd(
      [
        phase(1, [
          { id: "T001", paths: ["src/config.ts"] },
          { id: "T002", paths: ["src/decisions.ts"] },
        ]),
        phase(2, [
          { id: "T010", story: 1, paths: ["src/analyze.ts"] },
          { id: "T011", story: 1, parallel: true, paths: ["test/unit.test.ts"] },
          { id: "T012", story: 1, parallel: true, paths: ["test/cli.test.ts"] },
        ]),
      ],
      { feature: F },
    ),
  );
  const first = await runCommand(new LaneCommand(), p.root, [F], { next: true });
  if (first.code !== 0) throw new Error(first.err);
  return p;
}

async function runToEnd(h: Harness, max = 40): Promise<unknown> {
  let out: unknown = null;
  for (let i = 0; i < max && out === null; i++) out = await h.step();
  return out;
}

describe.skipIf(!HAS_GIT)("run executes sequential tasks, in order (the 2.0 dogfood)", () => {
  it("phase 1's sequential tasks run first as one lane; phase 2 runs T010, then T011 and T012 in parallel; nothing starts early", async () => {
    const p = await project();
    const h = harness(p, { assistants: ["claude"], stages: true, unattended: true });
    const started: { tasks: string; mergedBefore: string[] }[] = [];
    const merged = (): string[] => h.s.lanes.filter((l) => readLaneFile(p.root, h.run, l.file.lane)?.status === "merged").map((l) => l.file.lane);
    script(h, p, (_cwd, prompt) => {
      const ids = /check each off in tasks\.md: ([T0-9, ]+)\./.exec(prompt)?.[1];
      if (ids) started.push({ tasks: ids, mergedBefore: merged() });
      return { work: true };
    });
    const out = await runToEnd(h);
    expect(out).toMatchObject({ kind: "done" });
    expect(started.map((s) => s.tasks)).toEqual(["T001, T002", "T010", "T011", "T012"]);
    // the serial lane of phase 1 merged before anything of phase 2 started; T010 merged before T011/T012 started
    expect(started[1]!.mergedBefore).toContain("lane-1-1");
    expect(started[2]!.mergedBefore).toEqual(expect.arrayContaining(["lane-1-1", "lane-2-1"]));
    expect(h.s.lanes.map((l) => l.file.lane)).toEqual(["lane-1-1", "lane-2-1", "lane-2-2", "lane-2-3"]);
  });

  it("a feature with only sequential tasks runs to the end", async () => {
    const p = laneProject(F, tasksMd([phase(1, [{ id: "T001", paths: ["src/a.ts"] }, { id: "T002", paths: ["src/b.ts"] }])], { feature: F }));
    await runCommand(new LaneCommand(), p.root, [F], { next: true });
    const h = harness(p, { assistants: ["claude"], stages: true, unattended: true });
    script(h, p, { work: true });
    expect(await runToEnd(h)).toMatchObject({ kind: "done" });
    expect(readLaneFile(p.root, h.run, "lane-1-1")?.status).toBe("merged");
  });

  it("without stage preparation (1.6 sessions) the run still ends when its prepared lanes merged", async () => {
    const p = await project();
    const h = harness(p, { assistants: ["claude"], unattended: true });
    script(h, p, { work: true });
    const out = await runToEnd(h);
    expect(out).not.toBeNull();
    expect(h.s.lanes.map((l) => l.file.lane)).toEqual(["lane-1-1"]);
  });
});

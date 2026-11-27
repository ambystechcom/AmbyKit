import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { RunCommand } from "../../src/cli/run.js";
import { FakePort, fakeRegistry } from "../helpers/run-fakes.js";
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
  it("the default task budget covers the whole feature, not only the first stage (found by the live check: 1 of 2 used stopped a continued run)", async () => {
    const p = await project(); // only stage 1 (T001, T002) is prepared; the feature has 5 open tasks
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port: new FakePort() }), p.root, [F], {});
    expect(r.out).toContain("10 task events"); // twice the feature's 5 open tasks
  });
  it("the phase's Verify line goes only to the reviewers of its last stage; an earlier stage is judged on its own tasks (the 2.0 dogfood)", async () => {
    const md = [
      "---", `feature: ${F}`, "---", "", "# Tasks", "",
      "## Phase 1", "", "- [ ] [T001] task T001 (src/config.ts)", "",
      "## Phase 2", "",
      "- [ ] [T010] [US1] task T010 (src/analyze.ts)",
      "- [ ] [T011] [P] [US1] task T011 (test/unit.test.ts)",
      "- [ ] [T012] [P] [US1] task T012 (test/cli.test.ts)",
      "- **Verify:** `npx vitest run test/unit.test.ts test/cli.test.ts` passes", "",
    ].join("\n");
    const p = laneProject(F, md);
    await runCommand(new LaneCommand(), p.root, [F], { next: true });
    const h = harness(p, { assistants: ["claude"], stages: true, unattended: true, review: true });
    const reviews: string[] = [];
    script(h, p, (_cwd, prompt) => {
      if (/Write your verdict to/.test(prompt)) reviews.push(prompt);
      return { work: true };
    });
    expect(await runToEnd(h)).toMatchObject({ kind: "done" });
    const of = (lane: string): string[] => reviews.filter((r) => r.includes(`Review lane ${lane} of`));
    // phase 2's serial stage (T010): judged on T010, never on the phase's Verify line
    expect(of("lane-2-1").length).toBeGreaterThan(0);
    for (const r of of("lane-2-1")) {
      expect(r).toContain("earlier stage of phase 2");
      expect(r).toContain("(T010)");
      expect(r).not.toContain("Run this check");
    }
    // phase 2's last stage (T011 | T012): the phase's Verify line
    for (const lane of ["lane-2-2", "lane-2-3"]) {
      expect(of(lane).length).toBeGreaterThan(0);
      for (const r of of(lane)) expect(r).toContain("Run this check and judge its result: **Verify:** `npx vitest run test/unit.test.ts test/cli.test.ts` passes");
    }
    // a single-stage phase without a Verify line: unchanged
    for (const r of of("lane-1-1")) expect(r).toContain("The phase has no Verify line");
  });

});

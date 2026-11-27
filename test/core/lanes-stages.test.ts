import { describe, expect, it } from "vitest";
import { isLastStageOfPhase, planNextStage } from "../../src/core/lanes.js";
import { readTasks } from "../../src/core/spec-format/dispatch.js";

/**
 * Stages (the 2.0 dogfood, owner decision: `run` executes sequential tasks too). `planLanes` lanes only `[P]` tasks, so
 * 037's Phase 1 (T001, T002) and T010 never ran and its Phase 2 lanes started anyway. `planNextStage` covers every open
 * task: the lowest phase first, consecutive non-`[P]` tasks as one serial lane, consecutive `[P]` tasks as parallel lanes.
 */

const tasks = (md: string) => readTasks(md).tasks;

// 037's shape: a sequential foundation, then a phase that starts sequential and continues in parallel, then polish
const F037 = tasks(`# Tasks

## Phase 1 — Foundational

- [ ] [T001] Config key (src/core/config.ts)
- [ ] [T002] Option on analyzeDecisions (src/core/decisions.ts)

## Phase 2 — US-1

- [ ] [T010] [US1] Wire it in analyzeProject (src/core/analyze.ts)
- [ ] [T011] [P] [US1] Unit tests (test/core/decisions-severity.test.ts)
- [ ] [T012] [P] [US1] CLI tests (test/cli/analyze-decisions-severity.test.ts)

## Phase 4 — Polish

- [ ] [T030] [P] Docs (docs/cli-reference.md)
- [ ] [T031] [P] Mark 022 resolved (specs/022-amby-decide/plan.md)
- [ ] [T032] Docs test (test/docs-037.test.ts)
- [ ] [T033] Full gate
`);

const tick = (list: ReturnType<typeof tasks>, ids: string[]) => list.map((t) => (ids.includes(t.id) ? { ...t, done: true } : t));

describe("planNextStage: every open task runs, in order", () => {
  it("phase 1's sequential tasks come first, as one serial lane with the tasks in order", () => {
    const s = planNextStage("037-x", F037);
    expect(s).toMatchObject({ status: "planned", phase: 1, kind: "serial" });
    expect(s.lanes).toHaveLength(1);
    expect(s.lanes[0]!.name).toBe("037-x.lane-1-1");
    expect(s.lanes[0]!.tasks.map((t) => t.id)).toEqual(["T001", "T002"]);
  });

  it("nothing of phase 2 is planned while phase 1 has an open task", () => {
    const s = planNextStage("037-x", tick(F037, ["T001"]));
    expect(s.phase).toBe(1);
    expect(s.lanes.flatMap((l) => l.tasks.map((t) => t.id))).toEqual(["T002"]);
  });

  it("phase 2 starts with its sequential T010, then its [P] tasks run in parallel lanes", () => {
    const after1 = tick(F037, ["T001", "T002"]);
    expect(planNextStage("037-x", after1, { firstIndex: 1 })).toMatchObject({ phase: 2, kind: "serial", lanes: [{ tasks: [{ id: "T010" }] }] });
    const s = planNextStage("037-x", tick(after1, ["T010"]), { lanes: 2, firstIndex: 2 });
    expect(s).toMatchObject({ status: "planned", phase: 2, kind: "parallel" });
    expect(s.lanes.map((l) => [l.name, l.tasks.map((t) => t.id)])).toEqual([
      ["037-x.lane-2-2", ["T011"]],
      ["037-x.lane-2-3", ["T012"]],
    ]);
  });

  it("tasks.md order is kept within a phase: [P] docs first, then the sequential docs test and the full gate", () => {
    const upTo4 = tick(F037, ["T001", "T002", "T010", "T011", "T012"]);
    expect(planNextStage("037-x", upTo4)).toMatchObject({ phase: 4, kind: "parallel" });
    const s = planNextStage("037-x", tick(upTo4, ["T030", "T031"]));
    expect(s).toMatchObject({ phase: 4, kind: "serial" });
    expect(s.lanes[0]!.tasks.map((t) => t.id)).toEqual(["T032", "T033"]);
  });

  it("a feature with only sequential tasks runs (one serial lane per phase)", () => {
    const only = tasks(`## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T002] b (src/b.ts)\n\n## Phase 2\n\n- [ ] [T010] c (src/c.ts)\n`);
    expect(planNextStage("001-x", only)).toMatchObject({ status: "planned", phase: 1, kind: "serial", lanes: [{ tasks: [{ id: "T001" }, { id: "T002" }] }] });
  });

  it("tasks a merged lane of the run owned count as done even if a hand-resolved merge lost their tick", () => {
    const s = planNextStage("037-x", F037, { done: new Set(["T001", "T002"]) });
    expect(s).toMatchObject({ phase: 2, kind: "serial", lanes: [{ tasks: [{ id: "T010" }] }] });
  });

  it("done when every task is checked off", () => {
    expect(planNextStage("037-x", F037.map((t) => ({ ...t, done: true })))).toMatchObject({ status: "done", lanes: [] });
  });

  it("a sequential task without a declared path is still run (the full gate)", () => {
    const s = planNextStage("037-x", F037.map((t) => ({ ...t, done: t.id !== "T033" })));
    expect(s.lanes[0]!.tasks).toEqual([{ id: "T033", paths: [] }]);
  });

  it("[P] tasks of one stage that touch the same path are a conflict; a sequential task sharing a path is not", () => {
    const shared = tasks(`## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T002] [P] b (src/a.ts)\n- [ ] [T003] [P] c (src/a.ts)\n`);
    expect(planNextStage("001-x", shared)).toMatchObject({ kind: "serial", status: "planned" });
    expect(planNextStage("001-x", tick(shared, ["T001"]))).toMatchObject({ kind: "parallel", status: "conflict" });
  });
});

describe("isLastStageOfPhase: the phase's Verify line judges only its last stage (the 2.0 dogfood: T010's stage failed QA on T011/T012's tests)", () => {
  const afterPhase1 = tick(F037, ["T001", "T002"]);

  it("037 phase 2's serial stage (T010) is not the last: T011 and T012 run after it", () => {
    expect(isLastStageOfPhase(afterPhase1, ["T010"], 2)).toBe(false);
    // its worker ticked T010: still the same stage
    expect(isLastStageOfPhase(tick(afterPhase1, ["T010"]), ["T010"], 2)).toBe(false);
  });

  it("phase 2's parallel stage (T011 | T012) is the last, for each of its lanes, whatever the sibling has ticked", () => {
    const afterT010 = tick(afterPhase1, ["T010"]);
    expect(isLastStageOfPhase(afterT010, ["T011"], 2)).toBe(true);
    expect(isLastStageOfPhase(tick(afterT010, ["T011"]), ["T012"], 2)).toBe(true);
  });

  it("phase 4 = a parallel stage then a serial one: the parallel stage is not last, the serial one is", () => {
    const toPhase4 = tick(F037, ["T001", "T002", "T010", "T011", "T012"]);
    expect(isLastStageOfPhase(toPhase4, ["T030"], 4)).toBe(false);
    expect(isLastStageOfPhase(tick(toPhase4, ["T030", "T031"]), ["T032", "T033"], 4)).toBe(true);
  });

  it("a single-stage phase is its own last stage (unchanged behaviour)", () => {
    expect(isLastStageOfPhase(F037, ["T001", "T002"], 1)).toBe(true);
  });

  it("a lane that is not a stage of the plan (a 1.6 lane of [P] tasks only, sequential ones still open) keeps the old rule", () => {
    expect(isLastStageOfPhase(afterPhase1, ["T011"], 2)).toBe(true);
  });
});

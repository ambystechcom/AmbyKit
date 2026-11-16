import { describe, expect, it } from "vitest";
import {
  determinePhase,
  freeSlots,
  nextRoundAction,
  parseVerdict,
  rebuildFromTasks,
  recordOverlap,
  verdictPath,
  type FlowInput,
  type FlowTask,
} from "../../src/core/fleet/run-flow.js";
import type { RunLane } from "../../src/core/fleet/types.js";

const task = (id: string, phase: number, done = false, blocked?: string): FlowTask => ({ id, phase, done, ...(blocked !== undefined ? { blocked } : {}) });

const base = (over: Partial<FlowInput> = {}): FlowInput => ({
  feature: "019-demo",
  specStatus: "ready",
  hasPlan: true,
  hasTasks: true,
  tasks: [task("T001", 1), task("T002", 1), task("T010", 2)],
  phases: [],
  ...over,
});

describe("determinePhase", () => {
  it("019:FR-002: no spec.md stops and names it", () => {
    expect(determinePhase(base({ specStatus: null }))).toMatchObject({ kind: "stop", missing: "spec.md", reason: "missing", command: "/amby.specify" });
  });

  it("019:FR-002: a draft spec is not approved and stops before any phase", () => {
    expect(determinePhase(base({ specStatus: "draft" }))).toMatchObject({ kind: "stop", missing: "spec.md", reason: "not-approved" });
  });

  it("019:FR-002: no plan, then no tasks, each stop names that artifact", () => {
    expect(determinePhase(base({ hasPlan: false }))).toMatchObject({ kind: "stop", missing: "plan.md", command: "/amby.plan" });
    expect(determinePhase(base({ hasTasks: false, tasks: [] }))).toMatchObject({ kind: "stop", missing: "tasks.md", command: "/amby.tasks" });
  });

  it("019:FR-001: continues from the first incomplete phase, listing the open tasks", () => {
    const step = determinePhase(base({ tasks: [task("T001", 1, true), task("T002", 1), task("T010", 2)] }));
    expect(step).toEqual({ kind: "phase", phase: 1, stage: "working", pending: ["T002"], blocked: [] });
  });

  it("019:FR-001: a half-checked later phase is where the run resumes, earlier phases are skipped", () => {
    const step = determinePhase(base({ tasks: [task("T001", 1, true), task("T002", 1, true), task("T010", 2, true), task("T011", 2)], phases: [{ phase: 1, check: "x", result: "passed" }] }));
    expect(step).toMatchObject({ kind: "phase", phase: 2, stage: "working", pending: ["T011"] });
  });

  it("019:FR-009: a phase with every task checked but no passing Verify continues at QA", () => {
    const tasks = [task("T001", 1, true), task("T010", 2)];
    expect(determinePhase(base({ tasks, phases: [{ phase: 1, check: "npm test" }] }))).toMatchObject({ kind: "phase", phase: 1, stage: "qa", pending: [] });
    expect(determinePhase(base({ tasks, phases: [{ phase: 1, check: "npm test", result: "failed" }] }))).toMatchObject({ phase: 1, stage: "qa" });
    expect(determinePhase(base({ tasks, phases: [{ phase: 1, check: "npm test", result: "unverified" }] }))).toMatchObject({ phase: 1, stage: "qa" });
    expect(determinePhase(base({ tasks, phases: [{ phase: 1, check: "npm test", result: "passed" }] }))).toMatchObject({ phase: 2, stage: "working" });
  });

  it("019:FR-009: a phase with no Verify line is complete once its tasks are checked", () => {
    expect(determinePhase(base({ tasks: [task("T001", 1, true), task("T010", 2)] }))).toMatchObject({ phase: 2 });
  });

  it("019:FR-008: blocked tasks are listed apart and not offered as pending", () => {
    const step = determinePhase(base({ tasks: [task("T001", 1, false, "needs a key"), task("T002", 1)] }));
    expect(step).toMatchObject({ kind: "phase", phase: 1, pending: ["T002"], blocked: ["T001"] });
  });

  it("019:FR-003: a finished feature is done; it asks for converge until the spec is marked done", () => {
    const tasks = [task("T001", 1, true), task("T010", 2, true)];
    const phases = [{ phase: 1, check: "a", result: "passed" as const }, { phase: 2, check: "b", result: "passed" as const }];
    expect(determinePhase(base({ tasks, phases }))).toEqual({ kind: "done", needsConverge: true });
    expect(determinePhase(base({ tasks, phases, specStatus: "done" }))).toEqual({ kind: "done", needsConverge: false });
  });

  it("019:FR-001: unknown states are reported, not guessed", () => {
    expect(determinePhase(base({ specStatus: "banana" }))).toMatchObject({ kind: "unknown" });
    expect(determinePhase(base({ tasks: [] }))).toMatchObject({ kind: "unknown" });
  });
});

describe("parseVerdict and verdictPath", () => {
  const fail = JSON.stringify({ verdict: "fail", findings: [{ id: "QA-1", severity: "major", finding: "no test", fix: "add one" }, { id: "QA-2", severity: "minor", finding: "naming", fix: "rename" }] });

  it("019:FR-010: a failing verdict yields the finding IDs to return to the worker", () => {
    const r = parseVerdict(fail);
    expect(r).toMatchObject({ ok: true, failingIds: ["QA-1", "QA-2"] });
    if (r.ok) expect(r.verdict.findings[0]).toEqual({ id: "QA-1", severity: "major", finding: "no test", fix: "add one" });
  });

  it("019:FR-010: a pass has no failing IDs, even with advisory findings", () => {
    expect(parseVerdict('{"verdict":"pass"}')).toMatchObject({ ok: true, failingIds: [] });
    expect(parseVerdict('{"verdict":"pass","findings":[{"id":"A-1","finding":"nit"}]}')).toMatchObject({ ok: true, failingIds: [] });
  });

  it("019:FR-010: malformed verdicts are refused with a reason", () => {
    for (const bad of ["not json", "[]", '{"verdict":"maybe"}', '{"verdict":"fail"}', '{"verdict":"fail","findings":[{"finding":"x"}]}', '{"verdict":"fail","findings":[{"id":"A","finding":"x"},{"id":"A","finding":"y"}]}', '{"verdict":"pass","findings":"x"}']) {
      expect(parseVerdict(bad), bad).toMatchObject({ ok: false });
    }
  });

  it("019:FR-011: the verdict path is one file per lane, role and round, with the short lane form", () => {
    expect(verdictPath("019-demo.lane-2-1", "qa", 1)).toBe("verdicts/lane-2-1.qa.1.json");
    expect(verdictPath("lane-2-1", "architect", 3)).toBe("verdicts/lane-2-1.architect.3.json");
    expect(() => verdictPath("lane-2-1", "pm" as never, 1)).toThrow();
    expect(() => verdictPath("lane-2-1", "qa", 0)).toThrow();
  });
});

describe("nextRoundAction", () => {
  it("019:FR-012: retries below the limit and escalates at and over it", () => {
    expect(nextRoundAction(1, 3)).toBe("retry");
    expect(nextRoundAction(2, 3)).toBe("retry");
    expect(nextRoundAction(3, 3)).toBe("escalate");
    expect(nextRoundAction(5, 3)).toBe("escalate");
  });

  it("019:SC-003: a loop always ends within the limit, whatever the limit", () => {
    for (const limit of [1, 2, 3, 7]) {
      let rounds = 0;
      while (nextRoundAction(rounds, limit) === "retry") rounds += 1;
      expect(rounds).toBe(limit);
    }
  });

  it("019:FR-012: a damaged limit (below 1 or not a number) never loops", () => {
    expect(nextRoundAction(0, 0)).toBe("escalate");
    expect(nextRoundAction(0, Number.NaN)).toBe("escalate");
  });
});

describe("rebuildFromTasks", () => {
  const run = { run: "019-demo.2", feature: "019-demo", limit: 3, now: new Date("2026-11-16T12:00:00Z") };

  it("019:FR-015: rebuilds the phase and stage from checked tasks, in 025's schema", () => {
    const rec = rebuildFromTasks(base({ tasks: [task("T001", 1, true), task("T002", 1, true), task("T010", 2)], phases: [{ phase: 1, check: "x", result: "passed" }] }), run);
    expect(rec).toEqual({
      run: "019-demo.2", feature: "019-demo", status: "active", phase: 2, stage: "working", round: 0, limit: 3, needsDecision: false,
      gates: [], lanes: [], approvals: [], escalations: [], createdAt: "2026-11-16T12:00:00.000Z",
    });
  });

  it("019:FR-015: a finished feature rebuilds as a done run on its last phase", () => {
    const rec = rebuildFromTasks(base({ tasks: [task("T001", 1, true), task("T010", 2, true)] }), run);
    expect(rec).toMatchObject({ status: "done", phase: 2 });
  });

  it("019:FR-015: arrays salvaged from the damaged record are kept", () => {
    const lanes: RunLane[] = [{ lane: "019-demo.lane-1-1", assistant: "claude", tasks: ["T001"] }];
    const rec = rebuildFromTasks(base(), run, { lanes, escalations: [{ decision: "go" }] });
    expect(rec.lanes).toEqual(lanes);
    expect(rec.escalations).toEqual([{ decision: "go" }]);
    expect(rec.gates).toEqual([]);
  });

  it("019:SC-001: rebuilding never discards completed work: it only ever moves forward", () => {
    const tasks = [task("T001", 1, true), task("T002", 1, true), task("T010", 2, true), task("T011", 2)];
    const rec = rebuildFromTasks(base({ tasks }), run);
    expect(rec.phase).toBe(2);
  });
});

describe("freeSlots", () => {
  it("019:FR-027: counts free slots under the total and per-type caps", () => {
    const s = freeSlots(["claude", "claude", "codex"], { total: 3, perType: 2 });
    expect(s).toEqual({ running: 3, free: 0, perType: { claude: { running: 2, free: 0 }, codex: { running: 1, free: 1 } } });
    expect(freeSlots([], { total: 3, perType: 2 })).toEqual({ running: 0, free: 3, perType: {} });
  });
});

describe("recordOverlap", () => {
  const lanes: RunLane[] = [
    { lane: "019-demo.lane-1-1", assistant: "claude", tasks: ["T001"] },
    { lane: "019-demo.lane-1-2", assistant: "claude", tasks: ["T002"] },
    { lane: "019-demo.lane-1-3", assistant: "codex", tasks: ["T003"] },
  ];

  it("019:FR-019: serialized records the fixed order on each lane involved, and only those", () => {
    const r = recordOverlap(lanes, { mode: "serialized", lanes: ["lane-1-1", "1-2"], mergeOrder: ["lane-1-2", "lane-1-1"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lanes[0]!.overlap).toEqual({ mode: "serialized", with: ["lane-1-2"], mergeOrder: ["lane-1-2", "lane-1-1"] });
    expect(r.lanes[1]!.overlap?.with).toEqual(["lane-1-1"]);
    expect(r.lanes[2]!.overlap).toBeUndefined();
  });

  it("019:FR-019: a squad needs one writer per shared file, in the squad, and a fixed merge order", () => {
    const r = recordOverlap(lanes, { mode: "squad", lanes: ["lane-1-1", "lane-1-3"], shared: ["src/a.ts", "src/b.ts"], writers: { "src/a.ts": "lane-1-1", "src/b.ts": "lane-1-3" }, mergeOrder: ["lane-1-1", "lane-1-3"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lanes[2]!.overlap).toEqual({ mode: "squad", with: ["lane-1-1"], writers: { "src/a.ts": "lane-1-1", "src/b.ts": "lane-1-3" }, mergeOrder: ["lane-1-1", "lane-1-3"] });
    expect(recordOverlap(lanes, { mode: "squad", lanes: ["lane-1-1", "lane-1-3"], shared: ["src/a.ts"], writers: {}, mergeOrder: ["lane-1-1", "lane-1-3"] })).toMatchObject({ ok: false, error: expect.stringMatching(/no writer for src\/a\.ts/) });
    expect(recordOverlap(lanes, { mode: "squad", lanes: ["lane-1-1", "lane-1-3"], shared: ["src/a.ts"], writers: { "src/a.ts": "lane-1-2" }, mergeOrder: ["lane-1-1", "lane-1-3"] })).toMatchObject({ ok: false });
  });

  it("019:FR-019: refuses fewer than two lanes, unknown lanes, a repeated lane and an order that misses one", () => {
    expect(recordOverlap(lanes, { mode: "serialized", lanes: ["lane-1-1"], mergeOrder: ["lane-1-1"] })).toMatchObject({ ok: false });
    expect(recordOverlap(lanes, { mode: "serialized", lanes: ["lane-1-1", "lane-9-9"], mergeOrder: ["lane-1-1", "lane-9-9"] })).toMatchObject({ ok: false, error: expect.stringMatching(/lane-9-9/) });
    expect(recordOverlap(lanes, { mode: "serialized", lanes: ["lane-1-1", "lane-1-1"], mergeOrder: ["lane-1-1", "lane-1-1"] })).toMatchObject({ ok: false });
    expect(recordOverlap(lanes, { mode: "serialized", lanes: ["lane-1-1", "lane-1-2"], mergeOrder: ["lane-1-1"] })).toMatchObject({ ok: false });
  });
});

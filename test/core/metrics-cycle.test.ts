import { describe, expect, it } from "vitest";
import { phaseCycles } from "../../src/core/metrics/cycle.js";
import { modelHistory } from "../../src/core/metrics/model.js";
import { fullHistory, historyOf, HOUR, specText, T0, tasksText, type ScriptStep } from "../helpers/metrics-history.js";

const cycles = (steps: ScriptStep[]) => phaseCycles(modelHistory(historyOf("100-x", steps)));
const hours = (ms: number | null) => (ms === null ? null : ms / 1000 / HOUR);

describe("cycle time per phase (feature 032, US-4)", () => {
  it("032:FR-007: a finished feature has a cycle time for every phase, from first commit to the commit that completes it", () => {
    const c = cycles(fullHistory("100-x", 0));
    const by = Object.fromEntries(c.map((x) => [x.phase, hours(x.ms)]));
    expect(by).toEqual({ spec: 2, plan: 1, tasks: 4, converge: 3 });
  });

  it("032:FR-007: the cycle starts at the first commit touching the artifact and is in epoch milliseconds", () => {
    const spec = cycles(fullHistory("100-x", 5 * HOUR)).find((x) => x.phase === "spec")!;
    expect(spec.startedAt).toBe((T0 + 5 * HOUR) * 1000);
    expect(spec.completedAt).toBe((T0 + 7 * HOUR) * 1000);
  });

  it("032:FR-007: a phase still in progress has no end and no duration", () => {
    const c = cycles([
      { at: 0, file: "spec.md", text: specText("100-x", "draft") },
      { at: HOUR, file: "tasks.md", text: tasksText(1, 4) },
    ]);
    expect(c.find((x) => x.phase === "spec")).toMatchObject({ completedAt: null, ms: null });
    expect(c.find((x) => x.phase === "tasks")).toMatchObject({ completedAt: null, ms: null });
    expect(c.find((x) => x.phase === "converge")).toBeUndefined();
  });

  it("032:FR-007: a spec set ready and later back to draft keeps its first completion (rewritten history yields fewer points, never an error)", () => {
    const c = cycles([
      { at: 0, file: "spec.md", text: specText("100-x", "draft") },
      { at: HOUR, file: "spec.md", text: specText("100-x", "ready") },
      { at: 3 * HOUR, file: "spec.md", text: specText("100-x", "draft") },
    ]);
    expect(hours(c.find((x) => x.phase === "spec")!.ms)).toBe(1);
  });

  it("032:FR-007: a history with no spec, plan or tasks commits yields no cycles", () => {
    expect(cycles([])).toEqual([]);
  });

  it("032:FR-019: the same history in the 2.x spec form gives the same cycle times", () => {
    const v1 = cycles(fullHistory("100-x", 0)).map((x) => [x.phase, x.ms]);
    const v2 = cycles(fullHistory("100-x", 0, { v2: true })).map((x) => [x.phase, x.ms]);
    expect(v2).toEqual(v1);
  });
});

import { describe, expect, it } from "vitest";
import { gapPoints } from "../../src/core/metrics/gap.js";
import { modelHistory } from "../../src/core/metrics/model.js";
import { historyOf, HOUR, specText, tasksText, type ScriptStep } from "../helpers/metrics-history.js";

const points = (steps: ScriptStep[]) => gapPoints(modelHistory(historyOf("100-x", steps)));

describe("converge gap rate (feature 032, US-4)", () => {
  it("032:FR-007: each converge run is a point: gap tasks appended divided by the requirement count", () => {
    const p = points([
      { at: 0, file: "spec.md", text: specText("100-x", "ready", { requirements: 4 }) },
      { at: HOUR, file: "tasks.md", text: tasksText(4, 4) },
      { at: 2 * HOUR, file: "tasks.md", text: tasksText(4, 4, { count: 2 }) },
      { at: 5 * HOUR, file: "tasks.md", text: tasksText(4, 4, { count: 3 }) },
    ]);
    expect(p.map((x) => [x.gapTasks, x.requirements, x.rate])).toEqual([
      [2, 4, 0.5],
      [1, 4, 0.25],
    ]);
    expect(p[0]!.commit).toBe("c2");
  });

  it("032:FR-007: no converge run, no points", () => {
    expect(points([{ at: 0, file: "tasks.md", text: tasksText(2, 4) }])).toEqual([]);
  });

  it("032:FR-007: a feature with no requirements gives a null rate, not a division by zero", () => {
    const p = points([
      { at: 0, file: "spec.md", text: specText("100-x", "ready", { requirements: 0 }) },
      { at: HOUR, file: "tasks.md", text: tasksText(1, 1, { count: 1 }) },
    ]);
    expect(p[0]).toMatchObject({ gapTasks: 1, requirements: 0, rate: null });
  });

  it("032:FR-007: checking gap tasks off is not another converge run", () => {
    const p = points([
      { at: 0, file: "spec.md", text: specText("100-x", "ready") },
      { at: HOUR, file: "tasks.md", text: tasksText(4, 4, { count: 2 }) },
      { at: 2 * HOUR, file: "tasks.md", text: tasksText(4, 4, { count: 2, done: true }) },
    ]);
    expect(p).toHaveLength(1);
  });
});

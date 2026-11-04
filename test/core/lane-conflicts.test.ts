import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { declarations, describeConflict, laneConflicts } from "../../src/core/lanes.js";
import { phase, tasksMd, type PhaseDef } from "../helpers/tasks-fixture.js";

const F = "015-parallel-lanes";
const conflicts = (phases: PhaseDef[]) => laneConflicts(F, parseTasks(tasksMd(phases)));

describe("laneConflicts", () => {
  it("reports a seeded collision by ids and path (SC-001)", () => {
    const c = conflicts([
      phase(1, [
        { id: "T001", parallel: true, paths: ["src/a.ts"] },
        { id: "T002", parallel: true, paths: ["src/a.ts", "src/b.ts"] },
      ]),
    ]);
    expect(c).toEqual([{ feature: F, phase: 1, path: "src/a.ts", tasks: ["T001", "T002"] }]);
    expect(describeConflict(c[0]!)).toMatch(/T001, T002.*src\/a\.ts.*sequence them/);
  });

  it("reports nothing for disjoint paths (SC-002)", () => {
    expect(
      conflicts([
        phase(1, [
          { id: "T001", parallel: true, paths: ["src/a.ts"] },
          { id: "T002", parallel: true, paths: ["src/b.ts"] },
        ]),
      ]),
    ).toEqual([]);
  });

  it("treats a directory and a file beneath it as overlapping, naming the directory", () => {
    const c = conflicts([
      phase(1, [
        { id: "T001", parallel: true, paths: ["src/core/"] },
        { id: "T002", parallel: true, paths: ["src/core/lanes.ts"] },
      ]),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]!.path).toBe("src/core");
  });

  it("ignores overlaps across phases", () => {
    expect(
      conflicts([
        phase(1, [{ id: "T001", parallel: true, paths: ["src/a.ts"] }]),
        phase(2, [{ id: "T002", parallel: true, paths: ["src/a.ts"] }]),
      ]),
    ).toEqual([]);
  });

  it("ignores two sequential tasks but flags [P] against sequential", () => {
    const seq = [
      { id: "T001", paths: ["src/a.ts"] },
      { id: "T002", paths: ["src/a.ts"] },
    ];
    expect(conflicts([phase(1, seq)])).toEqual([]);
    expect(conflicts([phase(1, [{ ...seq[0]!, parallel: true }, seq[1]!])])).toHaveLength(1);
  });

  it("ignores done tasks (FR-015)", () => {
    expect(
      conflicts([
        phase(1, [
          { id: "T001", parallel: true, done: true, paths: ["src/a.ts"] },
          { id: "T002", parallel: true, paths: ["src/a.ts"] },
        ]),
      ]),
    ).toEqual([]);
  });

  it("folds a path shared by many tasks into one finding", () => {
    const c = conflicts([
      phase(1, [
        { id: "T001", parallel: true, paths: ["docs/x.md"] },
        { id: "T002", parallel: true, paths: ["docs/x.md"] },
        { id: "T003", parallel: true, paths: ["docs/x.md"] },
      ]),
    ]);
    expect(c).toEqual([{ feature: F, phase: 1, path: "docs/x.md", tasks: ["T001", "T002", "T003"] }]);
  });

  it("compares case-insensitively", () => {
    expect(
      conflicts([
        phase(1, [
          { id: "T001", parallel: true, paths: ["Src/A.ts"] },
          { id: "T002", parallel: true, paths: ["src/a.ts"] },
        ]),
      ]),
    ).toHaveLength(1);
  });
});

describe("declarations", () => {
  it("lists open tasks with missing or glob paths, never done ones", () => {
    const tasks = parseTasks(
      tasksMd([
        phase(1, [
          { id: "T001", paths: null },
          { id: "T002", paths: "src/**/*.ts" },
          { id: "T003", done: true, paths: null },
          { id: "T004", paths: ["src/ok.ts"] },
        ]),
      ]),
    );
    expect(declarations(F, tasks)).toEqual([
      { feature: F, task: "T001", issue: "missing" },
      { feature: F, task: "T002", issue: "glob" },
    ]);
  });
});

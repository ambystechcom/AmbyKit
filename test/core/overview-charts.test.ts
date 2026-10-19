import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview, phaseOf, statusCounts } from "../../src/core/overview.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";

const load = (edges = false) => readFeatures(dashboardFixture({ edges })).features;

describe("status counts (US-2, FR-003, I-2)", () => {
  it("counts per status in fixed order, summing to the story total", () => {
    const counts = statusCounts(load());
    expect(Object.entries(counts)).toEqual([
      ["done", 5],
      ["in-progress", 1],
      ["draft", 2],
      ["blocked", 1],
      ["deferred", 1],
    ]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("unknown status values count as other; zero statuses are omitted", () => {
    const counts = statusCounts(load(true).filter((f) => f.dir === "008-beta"));
    expect(counts).toEqual({ other: 1 });
  });
});

describe("feature rows (US-2, FR-004, FR-005, FR-010, I-3, I-7)", () => {
  it("one row per feature in number order with percent and phase", () => {
    const rows = computeOverview(load()).features;
    expect(rows.map((r) => [r.ref, r.percent, r.phase])).toEqual([
      ["001", 100, "done"],
      ["002", 65, "implementing"],
      ["003", 0, "tasked"],
    ]);
  });

  it("no tasks.md → tasks null (not planned) and no percent; clarifications counted", () => {
    const mcp = computeOverview(load(true)).features.find((r) => r.name === "004-mcp")!;
    expect(mcp).toEqual({ ref: "004", name: "004-mcp", tasks: null, percent: null, phase: "specified", clarifications: 1 });
  });

  it("duplicate numbers are two distinct rows", () => {
    const rows = computeOverview(load(true)).features.filter((r) => r.name.startsWith("008-"));
    expect(rows.map((r) => r.ref)).toEqual(["008-alpha", "008-beta"]);
  });

  it("phase is the furthest step reached; ui.md never blocks later phases", () => {
    const base = load()[2]!; // 003-reports: tasks, none done
    expect(phaseOf({ ...base, tasks: null, artifacts: { ...base.artifacts, plan: false, ui: false } })).toBe("specified");
    expect(phaseOf({ ...base, tasks: null, artifacts: { ...base.artifacts, plan: false, ui: true } })).toBe("designed");
    expect(phaseOf({ ...base, tasks: null, artifacts: { ...base.artifacts, plan: true, ui: false } })).toBe("planned");
    expect(phaseOf(base)).toBe("tasked");
  });
});

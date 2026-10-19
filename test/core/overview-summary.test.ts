import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { applyFilters, computeOverview } from "../../src/core/overview.js";
import { dashboardFixture, emptyProject } from "../helpers/dashboard-fixture.js";

const load = (edges = false) => readFeatures(dashboardFixture({ edges })).features;

describe("overview summary (US-1, FR-002, I-1, SC-002)", () => {
  it("matches the spec's hand-computed fixture totals", () => {
    expect(computeOverview(load()).summary).toEqual({
      features: 3,
      featuresDone: 1,
      stories: 10,
      storiesDone: 5,
      tasksDone: 25,
      tasksTotal: 40,
      percent: 63,
    });
  });

  it("counts unassigned tasks in the totals", () => {
    const beta = load(true).filter((f) => f.dir === "008-beta");
    expect(computeOverview(beta).summary).toMatchObject({ tasksDone: 1, tasksTotal: 3 });
  });

  it("an empty project is all zeros with a null percent (FR-013)", () => {
    expect(computeOverview(readFeatures(emptyProject()).features).summary).toEqual({
      features: 0,
      featuresDone: 0,
      stories: 0,
      storiesDone: 0,
      tasksDone: 0,
      tasksTotal: 0,
      percent: null,
    });
  });

  it("passes parse issues through", () => {
    const issues = [{ file: "specs/x/tasks.md", reason: "bad" }];
    expect(computeOverview([], {}, { upNextCap: 5 }, issues).issues).toEqual(issues);
  });
});

describe("applyFilters (FR-011, I-9)", () => {
  it("--feature matches the ref or the directory name", () => {
    expect(applyFilters(load(), { feature: "002" }).map((f) => f.dir)).toEqual(["002-widgets"]);
    expect(applyFilters(load(), { feature: "003-reports" }).map((f) => f.dir)).toEqual(["003-reports"]);
  });

  it("a colliding number matches by directory name", () => {
    expect(applyFilters(load(true), { feature: "008-beta" }).map((f) => f.dir)).toEqual(["008-beta"]);
  });

  it("--status keeps matching stories and their tasks only, and drops empty features", () => {
    const scoped = applyFilters(load(), { status: "draft" });
    expect(scoped.map((f) => f.dir)).toEqual(["002-widgets", "003-reports"]);
    expect(computeOverview(load(), { status: "draft" }).summary).toMatchObject({
      features: 2,
      stories: 2,
      tasksDone: 0,
      tasksTotal: 7,
    });
  });
});

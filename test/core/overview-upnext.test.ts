import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview } from "../../src/core/overview.js";
import { dashboardFixture, type FeatureDef } from "../helpers/dashboard-fixture.js";

const load = (opts: Parameters<typeof dashboardFixture>[0] = {}) => readFeatures(dashboardFixture(opts)).features;

describe("up next (US-4, FR-009, I-6)", () => {
  it("lists undone tasks of stories not in Attention, feature then T### order, capped", () => {
    const { upNext } = computeOverview(load(), {}, { upNextCap: 5 });
    expect(upNext.items.map((i) => `${i.taskId} ${i.storyKey}`)).toEqual([
      "T014 002:US-2",
      "T001 003:US-1",
      "T002 003:US-1",
      "T003 003:US-1",
      "T004 003:US-1",
    ]);
    expect(upNext.eligible).toBe(9);
    expect(upNext.allDone).toBe(false);
  });

  it("tasks of blocked/waiting stories are excluded", () => {
    const { upNext } = computeOverview(load(), {}, { upNextCap: 50 });
    expect(upNext.items.some((i) => i.storyKey === "002:US-3" || i.storyKey === "002:US-4")).toBe(false);
  });

  it("the cap is configurable", () => {
    expect(computeOverview(load(), {}, { upNextCap: 2 }).upNext.items).toHaveLength(2);
  });

  it("unassigned tasks may appear, with a null story", () => {
    const beta = load({ edges: true }).filter((f) => f.dir === "008-beta");
    const { upNext } = computeOverview(beta, {}, { upNextCap: 5 });
    expect(upNext.items).toContainEqual({ taskId: "T090", storyKey: null, description: "unassigned cleanup (x.ts)", feature: "008-beta" });
  });

  it("allDone when nothing is open", () => {
    const features: FeatureDef[] = [{ dir: "001-x", stories: [{ id: 1, status: "done" }], tasks: { 1: [2, 2] } }];
    expect(computeOverview(load({ features }), {}, { upNextCap: 5 }).upNext).toEqual({ items: [], eligible: 0, allDone: true });
  });
});

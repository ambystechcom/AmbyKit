import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview } from "../../src/core/overview.js";
import { dashboardFixture, type FeatureDef } from "../helpers/dashboard-fixture.js";

const overview = (opts: Parameters<typeof dashboardFixture>[0], filters = {}) =>
  computeOverview(readFeatures(dashboardFixture(opts)).features, filters);

describe("attention (US-3, FR-007, FR-008, I-4)", () => {
  it("lists blocked then waiting stories with their unfinished blockers", () => {
    expect(overview({}).attention).toEqual([
      { key: "002:US-3", kind: "blocked", refs: ["US-2"], reason: "blocked-by US-2" },
      { key: "002:US-4", kind: "waiting", refs: ["US-2"], reason: "waiting on US-2" },
    ]);
  });

  it("graph problems come first: cycles and unknown references", () => {
    const items = overview({ edges: true }).attention;
    expect(items.slice(0, 3)).toEqual([
      { key: "008-alpha:US-1", kind: "graph-problem", refs: ["US-2"], reason: "dependency cycle with US-2" },
      { key: "008-alpha:US-2", kind: "graph-problem", refs: ["US-1"], reason: "dependency cycle with US-1" },
      { key: "008-beta:US-1", kind: "graph-problem", refs: ["US-9"], reason: "depends-on US-9 — unknown story" },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["graph-problem", "graph-problem", "graph-problem", "blocked", "waiting"]);
  });

  it("done blockers are hidden; a story whose blockers are all done drops out", () => {
    const features: FeatureDef[] = [
      {
        dir: "001-x",
        stories: [
          { id: 1, status: "done" },
          { id: 2, status: "draft", blockedBy: ["US-1"], dependsOn: ["US-1"] },
          { id: 3, status: "draft", blockedBy: ["US-1", "US-2"] },
        ],
      },
    ];
    expect(overview({ features }).attention).toEqual([
      { key: "001:US-3", kind: "blocked", refs: ["US-2"], reason: "blocked-by US-2" },
    ]);
  });

  it("status `blocked` alone is listed; done stories never appear", () => {
    const features: FeatureDef[] = [
      { dir: "001-x", stories: [{ id: 1, status: "blocked" }, { id: 2, status: "done", dependsOn: ["US-1"] }] },
    ];
    expect(overview({ features }).attention).toEqual([
      { key: "001:US-1", kind: "blocked", refs: [], reason: "status: blocked" },
    ]);
  });

  it("cross-feature dependencies resolve and read qualified", () => {
    const features: FeatureDef[] = [
      { dir: "001-a", stories: [{ id: 1, status: "in-progress" }] },
      { dir: "002-b", stories: [{ id: 1, status: "draft", dependsOn: ["001:US-1"] }] },
    ];
    expect(overview({ features }).attention).toEqual([
      { key: "002:US-1", kind: "waiting", refs: ["001:US-1"], reason: "waiting on 001:US-1" },
    ]);
  });

  it("filters scope the items but blockers still resolve outside the filter", () => {
    expect(overview({}, { status: "draft" }).attention).toEqual([
      { key: "002:US-4", kind: "waiting", refs: ["US-2"], reason: "waiting on US-2" },
    ]);
  });
});

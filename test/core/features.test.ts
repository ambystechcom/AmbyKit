import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture, emptyProject } from "../helpers/dashboard-fixture.js";

describe("readFeatures (feature 014)", () => {
  it("reads every feature in number order with artifacts and tasks", () => {
    const { features, issues } = readFeatures(dashboardFixture());
    expect(issues).toEqual([]);
    expect(features.map((f) => f.dir)).toEqual(["001-core", "002-widgets", "003-reports"]);
    const core = features[0]!;
    expect(core.artifacts).toEqual({ spec: true, ui: true, uiSignedOff: true, plan: true, tasks: true });
    expect(core.stories.map((s) => s.tasksDone)).toEqual([3, 3, 3, 3]);
    expect(core.tasks).toHaveLength(12);
  });

  it("missing tasks.md → tasks null; markers counted outside code (FR-005, FR-010)", () => {
    const f = readFeatures(dashboardFixture({ edges: true })).features.find((x) => x.dir === "004-mcp")!;
    expect(f.tasks).toBeNull();
    expect(f.artifacts.tasks).toBe(false);
    expect(f.clarifications).toEqual([expect.objectContaining({ text: "which transport?" })]);
  });

  it("colliding feature numbers get unique display refs (I-5)", () => {
    const { features } = readFeatures(dashboardFixture({ edges: true }));
    const refs = features.map((f) => f.displayRef);
    expect(refs).toContain("008-alpha");
    expect(refs).toContain("008-beta");
    expect(refs).toContain("001");
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("an unreadable file is skipped and named; the rest still loads (FR-014)", () => {
    const { features, issues } = readFeatures(dashboardFixture({ edges: true }));
    expect(issues).toEqual([{ file: "specs/009-broken/tasks.md", reason: "is a directory, not a file" }]);
    const broken = features.find((f) => f.dir === "009-broken")!;
    expect(broken.tasks).toBeNull();
    expect(features).toHaveLength(7);
  });

  it("no specs/ → no features", () => {
    expect(readFeatures(emptyProject())).toEqual({ features: [], issues: [] });
  });
});

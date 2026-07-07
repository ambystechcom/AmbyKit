import { describe, expect, it } from "vitest";
import { analyzeGraph } from "../src/core/analyze.js";
import type { StoryProgress } from "../src/core/dashboard.js";

function story(p: Partial<StoryProgress> & { id: string }): StoryProgress {
  const feature = p.feature ?? "001-x";
  const featureRef = p.featureRef ?? feature.replace(/-.*$/, "");
  return {
    id: p.id,
    displayId: p.displayId ?? p.id,
    featureRef,
    key: p.key ?? `${featureRef}:${p.id}`,
    title: p.title ?? p.id,
    priority: p.priority ?? "P1",
    status: p.status ?? "draft",
    dependsOn: p.dependsOn ?? [],
    blockedBy: p.blockedBy ?? [],
    feature,
    tasksTotal: p.tasksTotal ?? 1,
    tasksDone: p.tasksDone ?? 0,
    percent: p.percent ?? 0,
  };
}

describe("analyzeGraph", () => {
  it("detects a dependency cycle", () => {
    const report = analyzeGraph([
      story({ id: "US1", dependsOn: ["US2"] }),
      story({ id: "US2", dependsOn: ["US1"] }),
    ]);
    expect(report.issues.some((i) => i.kind === "cycle")).toBe(true);
  });

  it("detects a dangling reference", () => {
    const report = analyzeGraph([story({ id: "US1", blockedBy: ["US9"] })]);
    const dangling = report.issues.find((i) => i.kind === "dangling-reference");
    expect(dangling).toBeDefined();
    expect(dangling!.message).toContain("US9");
  });

  it("classifies blocked vs buildable by blocker completion (qualified ids)", () => {
    const report = analyzeGraph([
      story({ id: "US1", displayId: "US-1", status: "done" }),
      story({ id: "US2", displayId: "US-2", dependsOn: ["US1"] }), // blocker done -> buildable
      story({ id: "US3", displayId: "US-3", dependsOn: ["US2"] }), // blocker not done -> blocked
    ]);
    expect(report.buildable).toContain("001:US-2");
    expect(report.blocked.map((b) => b.displayId)).toContain("001:US-3");
    expect(report.blocked.find((b) => b.displayId === "001:US-3")!.on).toContain("001:US-2");
  });

  it("reports stories with no tasks as orphans", () => {
    const report = analyzeGraph([story({ id: "US1", displayId: "US-1", tasksTotal: 0 })]);
    expect(report.orphans).toContain("001:US-1");
  });

  it("is clean for a well-formed graph", () => {
    const report = analyzeGraph([
      story({ id: "US1", status: "done" }),
      story({ id: "US2", dependsOn: ["US1"] }),
    ]);
    expect(report.issues).toHaveLength(0);
  });

  it("does NOT conflate the same local id across features", () => {
    // US-1 exists in both features; a bare dependency resolves within its own feature.
    const report = analyzeGraph([
      story({ id: "US1", displayId: "US-1", feature: "001-a", status: "done" }),
      story({ id: "US1", displayId: "US-1", feature: "002-b", dependsOn: ["US2"] }), // 002:US-1 -> blocked by 002:US-2
      story({ id: "US2", displayId: "US-2", feature: "002-b" }),
    ]);
    expect(report.issues).toHaveLength(0); // no false cycle/dangling from the shared "US-1"
    // 002:US-1 is blocked by 002:US-2 (not the done 001:US-1)
    const blocked = report.blocked.find((b) => b.displayId === "002:US-1");
    expect(blocked).toBeDefined();
    expect(blocked!.on).toContain("002:US-2");
  });
});

import { describe, expect, it } from "vitest";
import {
  applyTasks,
  canonicalStoryId,
  parseStories,
  parseTasks,
} from "../src/core/dashboard.js";

describe("canonicalStoryId", () => {
  it("normalizes US-1 / US1 / 'us 1' to US1", () => {
    expect(canonicalStoryId("US-1")).toBe("US1");
    expect(canonicalStoryId("US1")).toBe("US1");
    expect(canonicalStoryId("us 1")).toBe("US1");
  });
});

describe("parseStories", () => {
  const spec = [
    "### US-1 — Reset password  (priority: P1)",
    "",
    "As a user...",
    "- **status:** in-progress",
    "- **depends-on:** [US-0]",
    "- **blocked-by:** []",
    "",
    "### US-2 — Audit log  (priority: P3)",
    "- **status:** draft",
  ].join("\n");

  it("extracts id, title, priority, status, and dependencies", () => {
    const stories = parseStories(spec, "001-x");
    expect(stories).toHaveLength(2);
    const us1 = stories[0]!;
    expect(us1.id).toBe("US1");
    expect(us1.displayId).toBe("US-1");
    expect(us1.title).toBe("Reset password");
    expect(us1.priority).toBe("P1");
    expect(us1.status).toBe("in-progress");
    expect(us1.dependsOn).toEqual(["US0"]);
    expect(us1.blockedBy).toEqual([]);
    expect(stories[1]!.priority).toBe("P3");
  });
});

describe("parseTasks + applyTasks", () => {
  it("counts completed tasks per story and computes percent", () => {
    const tasks = parseTasks(
      [
        "- [x] [T001] [US1] create table (db/x.sql)",
        "- [ ] [T002] [P] [US1] add endpoint (api/x.ts)",
        "- [ ] [T003] [US2] audit (api/y.ts)",
        "not a task line",
      ].join("\n"),
    );
    expect(tasks).toHaveLength(3);
    expect(tasks[0]!).toMatchObject({ id: "T001", done: true, story: "US1" });
    expect(tasks[1]!.description).toBe("add endpoint (api/x.ts)");

    const stories = parseStories(
      "### US-1 — A  (priority: P1)\n### US-2 — B  (priority: P2)",
      "001-x",
    );
    applyTasks(stories, tasks);
    expect(stories[0]!).toMatchObject({ tasksTotal: 2, tasksDone: 1, percent: 50 });
    expect(stories[1]!).toMatchObject({ tasksTotal: 1, tasksDone: 0, percent: 0 });
  });

  it("reports 0% for a story with no tasks (no divide-by-zero)", () => {
    const stories = parseStories("### US-9 — Lonely  (priority: P2)", "001-x");
    applyTasks(stories, []);
    expect(stories[0]!.percent).toBe(0);
  });
});

import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSlice, laneTasks, nextTask, storyStatus, isFailed } from "../../src/core/query.js";
import { addLaneCheckout, project, tasksMd, type TaskFx } from "../mcp/fixture.js";

const alpha = (tasks: TaskFx[][], stories = [{ n: 1 }, { n: 2, dependsOn: ["US-1"] }]) =>
  project([{ dir: "001-alpha", stories, phases: tasks.map((t, i) => ({ title: `P${i + 1}`, tasks: t })) }]);

describe("query: next_task", () => {
  it("025:FR-001: returns the first unchecked task with its text, paths and story", () => {
    const root = alpha([[{ id: "T001", story: 1, done: true }, { id: "T002", story: 1, text: "Build the parser", paths: ["src/a.ts", "src/b.ts"] }]]);
    expect(nextTask(root, "001")).toEqual({ id: "T002", text: "Build the parser", paths: ["src/a.ts", "src/b.ts"], story: "US-1" });
  });

  it("025:FR-001: skips a task whose story is blocked by an unfinished story (the graph's blockersOf)", () => {
    const root = alpha([[{ id: "T001", story: 2, text: "needs US-1" }, { id: "T002", story: 1, text: "do US-1 first" }]]);
    expect(nextTask(root, "001")).toMatchObject({ id: "T002", story: "US-1" });
  });

  it("025:FR-001: skips a task marked BLOCKED (feature 020) and takes the next", () => {
    const root = alpha([[{ id: "T001", story: 1, marker: "⚠ BLOCKED: waiting on key" }, { id: "T002", story: 1 }]]);
    expect(nextTask(root, "001")).toMatchObject({ id: "T002" });
  });

  it("025:FR-001: says all blocked, with why, when every open task is blocked", () => {
    const root = alpha([[{ id: "T001", story: 1, marker: "⚠ BLOCKED: waiting on key" }, { id: "T002", story: 2 }]]);
    const out = nextTask(root, "001");
    expect(out).toMatchObject({ none: "all blocked" });
    expect((out as { why: string }).why).toMatch(/T001.*BLOCKED.*waiting on key/);
    expect((out as { why: string }).why).toMatch(/T002 waits on 001:US-1/);
  });

  it("025:FR-001: says done when every task is checked", () => {
    const root = alpha([[{ id: "T001", story: 1, done: true }]]);
    expect(nextTask(root, "001")).toMatchObject({ none: "done" });
  });

  it("025:FR-002: an unknown feature is an error naming it", () => {
    const out = nextTask(alpha([[{ id: "T001" }]]), "999");
    expect(isFailed(out) && out.error).toMatch(/feature '999' not found/);
  });

  it("025:FR-001: a task with no story tag is never blocked by a story", () => {
    const root = alpha([[{ id: "T001", text: "setup" }]]);
    expect(nextTask(root, "001")).toMatchObject({ id: "T001", story: null });
  });

  it("025:FR-001: given a lane, only that lane's tasks are considered", () => {
    const root = alpha([[{ id: "T001", story: 1 }, { id: "T002", story: 1 }, { id: "T003", story: 1 }]]);
    addLaneCheckout(root, "001-alpha", 1, 1, ["T002", "T003"], tasksMd("001-alpha", [{ title: "P1", tasks: [{ id: "T002", story: 1 }, { id: "T003", story: 1 }] }]));
    expect(nextTask(root, "001", "lane-1-1")).toMatchObject({ id: "T002" });
    expect(nextTask(root, "001", "1-1")).toMatchObject({ id: "T002" });
  });

  it("025:FR-002: an unknown lane is an error naming it and the lanes that exist", () => {
    const root = alpha([[{ id: "T001", story: 1 }]]);
    addLaneCheckout(root, "001-alpha", 1, 1, ["T001"], "");
    const out = nextTask(root, "001", "lane-9-9");
    expect(isFailed(out) && out.error).toMatch(/lane 'lane-9-9' not found.*lane-1-1/);
  });

  it("025:SC-001: the answer is under 1 KB and under 10% of a realistic tasks.md", () => {
    const many: TaskFx[] = Array.from({ length: 80 }, (_, i) => ({
      id: `T${String(i + 1).padStart(3, "0")}`,
      story: 1,
      done: i < 40,
      text: `Implement unit ${i + 1} with a reasonably long description of the work to do here`,
      paths: [`src/mod${i}.ts`, `test/mod${i}.test.ts`],
    }));
    const root = alpha([many]);
    const answer = JSON.stringify(nextTask(root, "001"));
    const size = statSync(join(root, "specs", "001-alpha", "tasks.md")).size;
    expect(answer.length).toBeLessThan(1024);
    expect(answer.length).toBeLessThan(size * 0.1);
  });
});

describe("query: story_status", () => {
  const root = project([
    { dir: "001-alpha", stories: [{ n: 1, status: "done" }, { n: 2, status: "in-progress", dependsOn: ["US-1"] }, { n: 3, status: "ready", dependsOn: ["US-2"] }] },
  ]);

  it("025:FR-001: returns status, priority and the unmet blockers by qualified id", () => {
    expect(storyStatus(root, "001", "US-3")).toEqual({ story: "US-3", status: "ready", priority: "P1", blockers: ["001:US-2"] });
    expect(storyStatus(root, "001", "US-2")).toMatchObject({ blockers: [] });
  });

  it("025:FR-001: accepts US2, US-2 and 001:US-2", () => {
    for (const ref of ["US2", "US-2", "001:US-2"]) expect(storyStatus(root, "001-alpha", ref)).toMatchObject({ story: "US-2" });
  });

  it("025:FR-002: an unknown story is an error naming it and the real ones", () => {
    const out = storyStatus(root, "001", "US-9");
    expect(isFailed(out) && out.error).toMatch(/story 'US-9' not found.*US-1, US-2, US-3/);
  });

  it("025:FR-002: an unknown feature is an error", () => {
    expect(isFailed(storyStatus(root, "042", "US-1"))).toBe(true);
  });

  it("025:FR-001: a dependency that does not resolve is named as written", () => {
    const r = project([{ dir: "001-alpha", stories: [{ n: 1, dependsOn: ["009:US-1"] }] }]);
    expect(storyStatus(r, "001", "US-1")).toMatchObject({ blockers: ["009:US-1"] });
  });
});

describe("query: lane_tasks", () => {
  it("025:FR-001: a lane's slice reads progress from the lane's own checkout", () => {
    const root = alpha([[{ id: "T001", story: 1 }, { id: "T002", story: 1 }, { id: "T003", story: 1 }]]);
    addLaneCheckout(root, "001-alpha", 1, 1, ["T001", "T002"], tasksMd("001-alpha", [{ title: "P1", tasks: [{ id: "T001", story: 1, done: true }, { id: "T002", story: 1 }, { id: "T003", story: 1 }] }]));
    const out = laneTasks(root, "001", "lane-1-1");
    expect(out).toEqual({ lane: "lane-1-1", tasks: [{ id: "T001", done: true, text: "do T001" }, { id: "T002", done: false, text: "do T002" }] });
  });

  it("025:FR-001: with no lane, the feature's tasks are returned, capped, with truncated:true", () => {
    const many: TaskFx[] = Array.from({ length: 60 }, (_, i) => ({ id: `T${String(i + 1).padStart(3, "0")}`, story: 1 }));
    const out = laneTasks(alpha([many]), "001");
    expect(out).toMatchObject({ lane: null, truncated: true });
    expect((out as { tasks: unknown[] }).tasks).toHaveLength(40);
  });

  it("025:FR-002: an unknown lane is an error", () => {
    expect(isFailed(laneTasks(alpha([[{ id: "T001" }]]), "001", "lane-3-3"))).toBe(true);
  });

  it("025:FR-002: an unknown feature is an error", () => {
    expect(isFailed(laneTasks(alpha([[{ id: "T001" }]]), "777"))).toBe(true);
  });
});

describe("query: analyze_report", () => {
  it("025:FR-001: returns the analyze findings sliced to one feature", () => {
    const root = project([
      { dir: "001-alpha", stories: [{ n: 1, dependsOn: ["US-9"] }], phases: [{ title: "P", tasks: [{ id: "T001", story: 1, marker: "⚠ BLOCKED: no key" }] }] },
      { dir: "002-beta", stories: [{ n: 1 }], phases: [{ title: "P", tasks: [{ id: "T001", story: 1 }] }] },
    ]);
    const a = analyzeSlice(root, "001");
    expect(isFailed(a)).toBe(false);
    if (isFailed(a)) return;
    expect(a.feature).toBe("001-alpha");
    expect(a.blockedTasks).toEqual([{ feature: "001", task: "T001", story: "US1", reason: "no key" }]);
    expect(a.issues.length).toBeGreaterThan(0);
    const b = analyzeSlice(root, "002");
    expect(isFailed(b) || b.blockedTasks).toEqual([]);
  });

  it("025:FR-002: an unknown feature is an error", () => {
    expect(isFailed(analyzeSlice(project([{ dir: "001-alpha", stories: [{ n: 1 }] }]), "555"))).toBe(true);
  });

  it("025:FR-001: with no feature it covers the whole project", () => {
    const root = project([{ dir: "001-alpha", stories: [{ n: 1 }] }, { dir: "002-beta", stories: [{ n: 1 }] }]);
    const a = analyzeSlice(root);
    expect(isFailed(a) || a.buildable.length).toBe(2);
  });
});

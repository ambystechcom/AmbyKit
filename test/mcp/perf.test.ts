import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { directivePath, readDirective } from "../../src/core/fleet/directives.js";
import { createRun } from "../../src/core/fleet/runs.js";
import { reportActivity } from "../../src/core/report.js";
import { nextTask, storyStatus } from "../../src/core/query.js";
import { project, type TaskFx } from "./fixture.js";

/** SC-003: a report and a directive read inside one second. SC-001: answers under 1 KB. */

const make = () => {
  const root = project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }]);
  const run = createRun(root, "001-alpha");
  if (!run.ok) throw new Error(run.warning);
  return { root, run: run.run.run };
};

describe("budgets (feature 025)", () => {
  it("025:SC-003: reportActivity writes the marker and reads the directive in under a second", () => {
    const { root, run } = make();
    const p = directivePath(root, run, "lane-1-1");
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify({ action: "pause", at: new Date().toISOString() }));
    const started = performance.now();
    const out = reportActivity(root, { feature: "001-alpha", agent: "claude", phase: "implement", state: "working", lane: "1-1", fleet: true });
    const ms = performance.now() - started;
    expect(out.directive).toBe("pause");
    expect(ms).toBeLessThan(1000);
  });

  it("025:SC-003: a directive read is well inside the budget, many times over", () => {
    const { root, run } = make();
    const started = performance.now();
    for (let i = 0; i < 200; i++) readDirective(root, run, "lane-1-1");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("025:SC-001: next_task and story_status answer in under 1 KB on a large feature", () => {
    const many: TaskFx[] = Array.from({ length: 300 }, (_, i) => ({
      id: `T${String(i + 1).padStart(3, "0")}`,
      story: (i % 8) + 1,
      done: i < 120,
      text: `Implement unit ${i + 1}: a long description of the work that goes on for a while to bulk up the file`,
      paths: [`src/m${i}.ts`, `test/m${i}.test.ts`],
    }));
    const stories = Array.from({ length: 8 }, (_, i) => ({ n: i + 1, status: "in-progress", title: "A story with a reasonably long title for realism" }));
    const root = project([{ dir: "001-alpha", stories, phases: [{ title: "Work", tasks: many }] }]);
    const started = performance.now();
    const next = JSON.stringify(nextTask(root, "001"));
    const story = JSON.stringify(storyStatus(root, "001", "US-3"));
    const ms = performance.now() - started;
    expect(next.length).toBeLessThan(1024);
    expect(story.length).toBeLessThan(1024);
    expect(ms).toBeLessThan(1000);
  });

  it("025:SC-001: the answer stays under 10% of the source file even for the smallest realistic feature", () => {
    const tasks: TaskFx[] = Array.from({ length: 30 }, (_, i) => ({ id: `T${String(i + 1).padStart(3, "0")}`, story: 1, text: `Do the thing number ${i + 1} properly, with care`, paths: [`src/f${i}.ts`] }));
    const root = project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks }] }]);
    const answer = JSON.stringify(nextTask(root, "001")).length;
    const tasksBytes = Buffer.byteLength(JSON.stringify(tasks));
    expect(answer).toBeLessThan(tasksBytes * 0.1);
  });
});

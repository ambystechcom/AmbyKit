import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStories, parseTasks } from "../../src/core/dashboard.js";
import { project } from "./fixture.js";
import { callTool, converse } from "./helpers.js";

const make = () =>
  project([
    {
      dir: "001-alpha",
      stories: [{ n: 1 }, { n: 2 }],
      phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }, { id: "T002", story: 2 }] }],
    },
  ]);

describe("write tools", () => {
  it("025:FR-003: tools/list publishes tick_task and set_story_status", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const names = r!.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(["tick_task", "set_story_status"]));
  });

  it("025:FR-003: tick_task checks off the task and reports it", async () => {
    const cwd = make();
    const out = await callTool("tick_task", { feature: "001", task: "T001" }, { cwd });
    expect(out.body).toEqual({ ticked: "T001" });
    const tasks = parseTasks(readFileSync(join(cwd, "specs", "001-alpha", "tasks.md"), "utf8"));
    expect(tasks.map((t) => t.done)).toEqual([true, false]);
  });

  it("025:FR-003: tick_task refuses unknown and already-checked tasks as errors", async () => {
    const cwd = make();
    await callTool("tick_task", { feature: "001", task: "T001" }, { cwd });
    const again = await callTool("tick_task", { feature: "001", task: "T001" }, { cwd });
    const unknown = await callTool("tick_task", { feature: "001", task: "T777" }, { cwd });
    expect([again.isError, unknown.isError]).toEqual([true, true]);
    expect(again.body.error).toMatch(/already checked/);
    expect(unknown.body.error).toMatch(/T777/);
  });

  it("025:FR-004: set_story_status changes the status; an invalid one is refused with the allowed values", async () => {
    const cwd = make();
    const ok = await callTool("set_story_status", { feature: "001", story: "US-2", status: "done" }, { cwd });
    expect(ok.body).toEqual({ story: "US-2", status: "done" });
    expect(parseStories(readFileSync(join(cwd, "specs", "001-alpha", "spec.md"), "utf8"), "001-alpha").map((s) => s.status)).toEqual(["ready", "done"]);
    const bad = await callTool("set_story_status", { feature: "001", story: "US-2", status: "finished" }, { cwd });
    expect(bad.isError).toBe(true);
    expect(bad.body.error).toMatch(/allowed: draft, ready, in-progress, blocked, done/);
  });

  it("025:FR-002: an unknown feature is an error naming it", async () => {
    const out = await callTool("tick_task", { feature: "099", task: "T001" }, { cwd: make() });
    expect(out.isError).toBe(true);
    expect(out.body.error).toMatch(/099/);
  });
});

import { describe, expect, it } from "vitest";
import { addLaneCheckout, project, tasksMd } from "./fixture.js";
import { callTool, converse } from "./helpers.js";

const root = () => {
  const r = project([
    {
      dir: "001-alpha",
      stories: [{ n: 1, status: "done" }, { n: 2, dependsOn: ["US-1"] }, { n: 3, dependsOn: ["US-2"] }],
      phases: [
        {
          title: "Work",
          tasks: [
            { id: "T001", story: 1, done: true },
            { id: "T002", story: 2, text: "Wire the thing", paths: ["src/x.ts"] },
            { id: "T003", story: 3 },
          ],
        },
      ],
    },
  ]);
  addLaneCheckout(r, "001-alpha", 1, 1, ["T002"], tasksMd("001-alpha", [{ title: "Work", tasks: [{ id: "T002", story: 2 }] }]));
  return r;
};

describe("read tools", () => {
  it("025:FR-001: tools/list publishes the four read tools with JSON schemas", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const names = r!.result.tools.map((t: { name: string }) => t.name);
    for (const n of ["next_task", "story_status", "lane_tasks", "analyze_report"]) expect(names).toContain(n);
    const next = r!.result.tools.find((t: { name: string }) => t.name === "next_task");
    expect(next.inputSchema.required).toEqual(["feature"]);
  });

  it("025:FR-001: next_task returns the next unblocked task", async () => {
    const out = await callTool("next_task", { feature: "001" }, { cwd: root() });
    expect(out.isError).toBe(false);
    expect(out.body).toEqual({ id: "T002", text: "Wire the thing", paths: ["src/x.ts"], story: "US-2" });
  });

  it("025:FR-001: next_task for a lane limits itself to that lane", async () => {
    const out = await callTool("next_task", { feature: "001", lane: "lane-1-1" }, { cwd: root() });
    expect(out.body.id).toBe("T002");
  });

  it("025:FR-001: story_status returns blockers", async () => {
    const out = await callTool("story_status", { feature: "001", story: "US-3" }, { cwd: root() });
    expect(out.body).toEqual({ story: "US-3", status: "ready", priority: "P1", blockers: ["001:US-2"] });
  });

  it("025:FR-001: lane_tasks returns the lane's slice", async () => {
    const out = await callTool("lane_tasks", { feature: "001", lane: "1-1" }, { cwd: root() });
    expect(out.body).toEqual({ lane: "lane-1-1", tasks: [{ id: "T002", done: false, text: "do T002" }] });
  });

  it("025:FR-001: analyze_report returns the sliced findings", async () => {
    const out = await callTool("analyze_report", { feature: "001" }, { cwd: root() });
    expect(out.isError).toBe(false);
    expect(out.body.feature).toBe("001-alpha");
    expect(out.body.buildable).toContain("001:US-2");
  });

  it("025:FR-002: unknown feature, story and lane are isError results that name them", async () => {
    const cwd = root();
    const f = await callTool("next_task", { feature: "404" }, { cwd });
    const s = await callTool("story_status", { feature: "001", story: "US-9" }, { cwd });
    const l = await callTool("lane_tasks", { feature: "001", lane: "lane-8-8" }, { cwd });
    expect([f.isError, s.isError, l.isError]).toEqual([true, true, true]);
    expect(f.body.error).toMatch(/404/);
    expect(s.body.error).toMatch(/US-9/);
    expect(l.body.error).toMatch(/lane-8-8/);
  });

  it("025:FR-002: a missing required input is an error naming the field", async () => {
    const out = await callTool("story_status", { feature: "001" }, { cwd: root() });
    expect(out.isError).toBe(true);
    expect(out.body.error).toMatch(/story/);
  });

  it("025:FR-017: outside an AmbyKit project every tool answers with an error instead of crashing", async () => {
    const out = await callTool("next_task", { feature: "001" }, { cwd: process.env["TEMP"] ?? "/" });
    expect(out.isError).toBe(true);
  });
});

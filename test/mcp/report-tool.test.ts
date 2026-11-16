import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readMarkers } from "../../src/core/activity.js";
import { directivePath } from "../../src/core/fleet/directives.js";
import { createRun } from "../../src/core/fleet/runs.js";
import { project } from "./fixture.js";
import { callTool, converse } from "./helpers.js";

const make = () => project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }]);
const args = { feature: "001", agent: "claude", phase: "implement", state: "working", lane: "lane-1-1" };

describe("report_activity tool", () => {
  it("025:FR-006: is published with state required and no progress input", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const tool = r!.result.tools.find((t: { name: string }) => t.name === "report_activity");
    expect(tool.inputSchema.required).toEqual(expect.arrayContaining(["feature", "agent", "phase", "state"]));
    expect(Object.keys(tool.inputSchema.properties)).not.toContain("progress");
    expect(tool.inputSchema.additionalProperties).toBe(false);
  });

  it("025:FR-006: rejects a progress field", async () => {
    const out = await callTool("report_activity", { ...args, progress: 40 }, { cwd: make() });
    expect(out.isError).toBe(true);
  });

  it("025:FR-009: returns an acknowledgement and the lane's directive, and records the marker", async () => {
    const cwd = make();
    const created = createRun(cwd, "001-alpha");
    if (!created.ok) throw new Error(created.warning);
    const p = directivePath(cwd, created.run.run, "lane-1-1");
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify({ action: "pause", at: new Date().toISOString() }));
    const out = await callTool("report_activity", args, { cwd });
    expect(out.isError).toBe(false);
    expect(out.body).toMatchObject({ ack: true, directive: "pause", run: created.run.run });
    expect(readMarkers(cwd)).toMatchObject([{ agent: "claude", lane: "001-alpha.lane-1-1", state: "working" }]);
  });

  it("025:FR-012: a report with no run still succeeds, with a warning and no error flag", async () => {
    const out = await callTool("report_activity", args, { cwd: make() });
    expect(out.isError).toBe(false);
    expect(out.body).toMatchObject({ ack: true, directive: "continue" });
    expect(out.body.warning).toMatch(/no unfinished run/);
  });

  it("025:FR-012: an unknown feature or no project is a warning on a normal result, never an error", async () => {
    const unknown = await callTool("report_activity", { ...args, feature: "404" }, { cwd: make() });
    expect(unknown.isError).toBe(false);
    expect(unknown.body).toMatchObject({ ack: false, directive: "continue" });
    expect(unknown.body.warning).toMatch(/404/);
    const none = await callTool("report_activity", args, { cwd: process.env["TEMP"] ?? "/" });
    expect(none.isError).toBe(false);
    expect(none.body.ack).toBe(false);
  });

  it("025:FR-006: refuses a state outside the five values", async () => {
    const out = await callTool("report_activity", { ...args, state: "sleeping" }, { cwd: make() });
    expect(out.isError).toBe(true);
  });
});

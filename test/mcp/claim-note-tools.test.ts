import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readClaims } from "../../src/core/fleet/claims.js";
import { notesPath } from "../../src/core/fleet/notes.js";
import { createRun } from "../../src/core/fleet/runs.js";
import { project } from "./fixture.js";
import { callTool, converse } from "./helpers.js";

const make = () => {
  const root = project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }, { id: "T002", story: 1 }] }] }]);
  const run = createRun(root, "001-alpha");
  if (!run.ok) throw new Error(run.warning);
  return { root, run: run.run.run };
};

describe("claim_file and post_note tools", () => {
  it("025:FR-015: tools/list publishes both", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    expect(r!.result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["claim_file", "post_note"]));
  });

  it("025:FR-015: claim_file claims, then refuses a second worker naming the owner", async () => {
    const { root, run } = make();
    const ok = await callTool("claim_file", { feature: "001", task: "T001", files: ["src/a.ts"], worker: "lane-1-1" }, { cwd: root });
    expect(ok.body).toEqual({ claimed: ["src/a.ts"] });
    expect(readClaims(root, run)["src/a.ts"]?.worker).toBe("lane-1-1");
    const refused = await callTool("claim_file", { feature: "001", task: "T002", files: ["src/a.ts"], worker: "lane-1-2" }, { cwd: root });
    expect(refused.isError).toBe(false);
    expect(refused.body).toEqual({ refused: { file: "src/a.ts", owner: "lane-1-1", task: "T001" } });
  });

  it("025:FR-015: ticking the task through tick_task frees its claims for the next worker", async () => {
    const { root } = make();
    await callTool("claim_file", { feature: "001", task: "T001", files: ["src/a.ts"], worker: "lane-1-1" }, { cwd: root });
    expect((await callTool("tick_task", { feature: "001", task: "T001" }, { cwd: root })).body).toEqual({ ticked: "T001" });
    const next = await callTool("claim_file", { feature: "001", task: "T002", files: ["src/a.ts"], worker: "lane-1-2" }, { cwd: root });
    expect(next.body).toEqual({ claimed: ["src/a.ts"] });
  });

  it("025:FR-016: post_note appends the line and refuses a missing task id or a newline", async () => {
    const { root, run } = make();
    const ok = await callTool("post_note", { feature: "001", task: "T001", files: ["src/a.ts"], text: "uses a map now" }, { cwd: root });
    expect(ok.body).toEqual({ posted: "T001 | src/a.ts | uses a map now" });
    expect(readFileSync(notesPath(root, run), "utf8")).toBe("T001 | src/a.ts | uses a map now\n");
    const noTask = await callTool("post_note", { feature: "001", task: "oops", files: [], text: "x" }, { cwd: root });
    const newline = await callTool("post_note", { feature: "001", task: "T001", files: [], text: "a\nb" }, { cwd: root });
    expect([noTask.isError, newline.isError]).toEqual([true, true]);
    expect(noTask.body.error).toMatch(/task id/);
    expect(newline.body.error).toMatch(/one line/);
  });

  it("025:FR-024: with no unfinished run both tools answer with an error naming why, and create nothing", async () => {
    const root = project([{ dir: "001-alpha", stories: [{ n: 1 }] }]);
    const claim = await callTool("claim_file", { feature: "001", task: "T001", files: ["a"], worker: "w" }, { cwd: root });
    const note = await callTool("post_note", { feature: "001", task: "T001", files: [], text: "x" }, { cwd: root });
    expect([claim.isError, note.isError]).toEqual([true, true]);
    expect(claim.body.error).toMatch(/no unfinished run/);
  });

  it("025:FR-002: an unknown feature is an error naming it", async () => {
    const { root } = make();
    const out = await callTool("claim_file", { feature: "404", task: "T001", files: ["a"], worker: "w" }, { cwd: root });
    expect(out.isError).toBe(true);
    expect(out.body.error).toMatch(/404/);
  });

  it("025:FR-015: an empty file list is refused by the schema", async () => {
    const { root } = make();
    expect((await callTool("claim_file", { feature: "001", task: "T001", files: [], worker: "w" }, { cwd: root })).isError).toBe(true);
  });
});

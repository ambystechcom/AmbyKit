import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { setStoryStatus, tickTask } from "../../src/core/tasks-edit.js";
import { storyOut } from "../helpers/spec-model.js";

/** 030:FR-018, FR-020 — the MCP tick and status tools behave the same on a 1.x project and its v2 twin. */
const TWINS = join(import.meta.dirname, "..", "fixtures", "spec-format-twins");

function twin(kind: "v1" | "v2"): string {
  const dir = mkdtempSync(join(tmpdir(), `ambykit-030-edit-${kind}-`));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  cpSync(join(TWINS, kind, "specs"), join(dir, "specs"), { recursive: true });
  return dir;
}
const spec = (dir: string): string => readFileSync(join(dir, "specs", "001-twin", "spec.md"), "utf8");
const tasks = (dir: string): string => readFileSync(join(dir, "specs", "001-twin", "tasks.md"), "utf8");

describe("MCP tick and status tools on v2 (030, FR-018, FR-020)", () => {
  it("030:FR-018: tick_task answers the same on the twins and flips only that checkbox", () => {
    const a = twin("v1");
    const b = twin("v2");
    const ra = tickTask(a, "001", "T010");
    const rb = tickTask(b, "001", "T010");
    expect(rb).toEqual(ra);
    expect(ra).toEqual({ ok: true, ticked: "T010", feature: "001-twin" });
    for (const dir of [a, b]) {
      const done = readTasks(tasks(dir)).tasks.filter((t) => t.done).map((t) => t.id);
      expect(done).toEqual(["T001", "T002", "T010"]);
    }
    const lines = (t: string) => t.split(/\r?\n/);
    expect(lines(tasks(b)).filter((l, i) => l !== lines(readFileSync(join(TWINS, "v2", "specs", "001-twin", "tasks.md"), "utf8"))[i])).toHaveLength(1);
  });

  it("030:FR-018: tick_task refuses the same things on the twins (unknown task, already checked)", () => {
    const a = twin("v1");
    const b = twin("v2");
    expect(tickTask(b, "001", "T999")).toMatchObject({ ok: false });
    expect(tickTask(b, "001", "T001")).toEqual(tickTask(a, "001", "T001"));
    expect(tickTask(b, "001", "T001")).toMatchObject({ ok: false, error: "task T001 is already checked" });
  });

  it("030:FR-020: set_story_status returns the same shape on the twins and changes only that story's status", () => {
    const a = twin("v1");
    const b = twin("v2");
    const ra = setStoryStatus(a, "001", "US-3", "in-progress");
    const rb = setStoryStatus(b, "001", "US-3", "in-progress");
    expect(rb).toEqual(ra);
    expect(ra).toEqual({ ok: true, story: "US-3", status: "in-progress", feature: "001-twin" });
    const after = readSpec("001-twin", spec(b)).stories.map(storyOut);
    const was = readSpec("001-twin", readFileSync(join(TWINS, "v2", "specs", "001-twin", "spec.md"), "utf8")).stories.map(storyOut);
    expect(after.filter((s) => s.id !== "US3")).toEqual(was.filter((s) => s.id !== "US3"));
    expect(after.find((s) => s.id === "US3")?.status).toBe("in-progress");
    expect(readSpec("001-twin", spec(a)).stories.map(storyOut)).toEqual(after);
  });

  it("030:FR-020: in v2 the status is written into the frontmatter, not as a bullet", () => {
    const b = twin("v2");
    setStoryStatus(b, "001", "US-4", "done");
    expect(spec(b)).toMatch(/- id: US-4\r?\n {4}priority: P3\r?\n {4}status: done/);
    expect(spec(b)).not.toMatch(/\*\*status:\*\*/);
  });

  it("030:FR-020: set_story_status refuses an unknown story and an invalid status on v2, like 1.x", () => {
    const a = twin("v1");
    const b = twin("v2");
    expect(setStoryStatus(b, "001", "US-9", "done")).toMatchObject({ ok: false });
    expect(setStoryStatus(a, "001", "US-9", "done")).toMatchObject({ ok: false });
    expect(setStoryStatus(b, "001", "US-1", "finished")).toEqual(setStoryStatus(a, "001", "US-1", "finished"));
  });

  it("030:FR-020: a v2 spec is left unmodified when the edit is refused", () => {
    const b = twin("v2");
    const before = spec(b);
    setStoryStatus(b, "001", "US-9", "done");
    expect(spec(b)).toBe(before);
  });
});

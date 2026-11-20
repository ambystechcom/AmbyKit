import { describe, expect, it } from "vitest";
import { laneConflicts } from "../../src/core/lanes.js";
import { readTasks } from "../../src/core/spec-format/dispatch.js";
import { phaseOut, taskOut } from "../helpers/spec-model.js";
import { fixture } from "../helpers/spec-project.js";

const model = (text: string, file = "specs/900-x/tasks.md") => {
  const r = readTasks(text, { file });
  return { format: r.format, tasks: r.tasks.map((t) => taskOut(t, r.format === 1)), phases: r.phases.map(phaseOut), issues: r.issues };
};

describe("v2 task reader (030, US-2)", () => {
  it("030:FR-002: the v1 form and both v2 layouts of the edge-rich tasks give equal tasks and phases", () => {
    const v1 = model(fixture("edge-rich", "tasks.v1.md"));
    const phase = model(fixture("edge-rich", "tasks.v2-phase.md"));
    const task = model(fixture("edge-rich", "tasks.v2-task.md"));
    expect([v1.format, phase.format, task.format]).toEqual([1, 2, 2]);
    expect(phase.tasks).toEqual(v1.tasks);
    expect(phase.phases).toEqual(v1.phases);
    expect(task.tasks).toEqual(v1.tasks);
    expect(task.phases).toEqual(v1.phases);
    expect(phase.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(task.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("030:FR-002: ownership and verify come from the block (files to paths, globs flagged, result and why)", () => {
    const r = readTasks(fixture("edge-rich", "tasks.v2-phase.md"));
    const t = (id: string) => r.tasks.find((x) => x.id === id);
    expect(t("T001")?.paths).toEqual(["src/a.ts", "src/b.ts"]);
    expect(t("T003")).toMatchObject({ paths: [], pathIssue: "glob" });
    const ph2 = r.phases.find((p) => p.phase === 2);
    expect(ph2).toMatchObject({ check: "first check", result: "failed", why: "it broke" });
    expect(r.phases.find((p) => p.phase === 1)).toMatchObject({ result: "passed" });
    expect(r.phases.find((p) => p.title === "Polish")).toMatchObject({ result: "unverified" });
  });

  it("030:FR-002: a task absent from files reads as no path, exactly like a 1.x task with no group", () => {
    const r = readTasks(fixture("edge-rich", "tasks.v2-phase.md"));
    expect(r.tasks.find((x) => x.id === "T005")).toMatchObject({ paths: [], pathIssue: "missing" });
    expect(r.tasks.find((x) => x.id === "T006")).toMatchObject({ paths: [], pathIssue: "missing" });
  });

  it("030:FR-002: a phase without a verify block has no Verify line", () => {
    const r = readTasks(fixture("edge-rich", "tasks.v2-phase.md"));
    const ph3 = r.phases.find((p) => p.title.startsWith("Phase 3"));
    expect(ph3?.check).toBeUndefined();
    expect(ph3?.result).toBeUndefined();
  });

  it("030:FR-002: BLOCKED and DEVIATION stay on the task line and read as before", () => {
    const v1 = readTasks(fixture("edge-rich", "tasks.v1.md")).tasks;
    const v2 = readTasks(fixture("edge-rich", "tasks.v2-phase.md")).tasks;
    for (const id of ["T004", "T011"]) {
      expect(v2.find((t) => t.id === id)?.blocked).toBe(v1.find((t) => t.id === id)?.blocked);
      expect(v2.find((t) => t.id === id)?.deviation).toBe(v1.find((t) => t.id === id)?.deviation);
    }
    expect(v2.find((t) => t.id === "T004")).toMatchObject({ blocked: "waiting on `(src/d.ts)`", deviation: "did it differently" });
    expect(v2.find((t) => t.id === "T011")?.blocked).toBe("");
  });

  it("030:FR-002: two tasks owning one file give the same lane conflict as in 1.x", () => {
    const v1 = "## Phase 1 — Go\n\n- [ ] [T001] [P] a (src/x.ts)\n- [ ] [T002] [P] b (src/x.ts)\n";
    const v2 = [
      "---",
      "format: 2",
      "---",
      "## Phase 1 — Go",
      "",
      "- [ ] [T001] [P] a",
      "- [ ] [T002] [P] b",
      "```yaml",
      "files:",
      "  T001: [src/x.ts]",
      "  T002: [src/x.ts]",
      "```",
      "",
    ].join("\n");
    const c1 = laneConflicts("900-x", readTasks(v1).tasks);
    const c2 = laneConflicts("900-x", readTasks(v2).tasks);
    expect(c1.length).toBeGreaterThan(0);
    expect(c2).toEqual(c1);
  });

  describe("malformed task data is a located error (030:FR-003)", () => {
    const issuesOf = (name: string) => readTasks(fixture("malformed", name), { file: `specs/9/${name}` }).issues;
    const errors = (name: string) => issuesOf(name).filter((i) => i.severity === "error");

    it("030:FR-003: invalid YAML names the file and line", () => {
      const e = errors("bad-yaml.tasks.md")[0];
      expect(e).toMatchObject({ file: "specs/9/bad-yaml.tasks.md", kind: "bad-yaml" });
      expect(e?.line).toBeGreaterThan(1);
    });

    it("030:FR-003: a result outside passed|failed|unverified is an error", () => {
      expect(errors("bad-result.tasks.md").some((i) => i.kind === "bad-result")).toBe(true);
    });

    it("030:FR-003: an unclosed block is an error at its opening fence", () => {
      const e = errors("unclosed.tasks.md").find((i) => i.kind === "block-unclosed");
      expect(e?.line).toBeGreaterThan(1);
    });

    it("030:FR-003: a block that mixes files with another top-level key is an error", () => {
      expect(errors("unknown-key.tasks.md").some((i) => i.kind === "unknown-key")).toBe(true);
    });

    it("030:FR-003: a task block that does not follow a task line is an error", () => {
      expect(errors("detached-task-block.tasks.md").some((i) => i.kind === "detached-block")).toBe(true);
    });

    it("030:FR-003: files naming a task of another phase is an error", () => {
      expect(errors("wrong-phase.tasks.md").some((i) => i.kind === "unknown-task")).toBe(true);
    });
  });

  it("030:FR-002: a foreign yaml fence (documentation) is ignored and the file stays 1.x", () => {
    const text = "## Phase 1 — Go\n\n- [ ] [T001] do (src/a.ts)\n\n```yaml\nname: example\nvalue: 1\n```\n";
    const r = readTasks(text);
    expect(r.format).toBe(1);
    expect(r.issues).toEqual([]);
    expect(r.tasks[0]?.paths).toEqual(["src/a.ts"]);
  });

  it("030:FR-004: a trailing group that disagrees with the block loses to the block and is reported", () => {
    const text = "---\nformat: 2\n---\n## Phase 1 — Go\n\n- [ ] [T001] do (src/old.ts)\n```yaml\nfiles:\n  T001: [src/new.ts]\n```\n";
    const r = readTasks(text);
    expect(r.tasks[0]?.paths).toEqual(["src/new.ts"]);
    expect(r.issues.find((i) => i.kind === "trailing-group-disagrees")).toMatchObject({ severity: "warning" });
  });

  it("030:FR-019: yaml blocks without format: 2 are read as v2 with one marker warning", () => {
    const text = "## Phase 1 — Go\n\n- [ ] [T001] do\n```yaml\nfiles:\n  T001: [src/a.ts]\n```\n";
    const r = readTasks(text);
    expect(r.format).toBe(2);
    expect(r.issues.filter((i) => i.kind === "missing-format-marker")).toHaveLength(1);
  });
});

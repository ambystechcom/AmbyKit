import { describe, expect, it } from "vitest";
import { hashText, scanSpec, scanTasks, specReadBack, tasksReadBack } from "../../src/core/migrate/safety.js";
import { UNSAFE } from "../helpers/spec-project.js";

const spec = (name: string) => UNSAFE[name]?.["spec.md"] ?? "";
const tasks = (name: string) => UNSAFE[name]?.["tasks.md"] ?? "";

describe("migrate safety scan (030, FR-006)", () => {
  it("030:FR-006: story metadata inside a prose sentence is unsafe, with the line", () => {
    const r = scanSpec(spec("910-prose-meta"));
    expect(r).toMatchObject({ kind: "prose-metadata" });
    expect(r?.reason).toMatch(/line \d+/);
    expect(r?.fix).toBeTruthy();
  });

  it("030:FR-006: two status bullets for one story are unsafe", () => {
    expect(scanSpec(spec("911-two-status"))).toMatchObject({ kind: "duplicate-bullet" });
  });

  it("030:FR-006: story metadata inside a code fence is unsafe", () => {
    expect(scanSpec(spec("914-fenced"))).toMatchObject({ kind: "fenced-metadata" });
  });

  it("030:FR-006: mixed line endings are unsafe", () => {
    expect(scanSpec(spec("913-mixed-eol"))).toMatchObject({ kind: "mixed-eol" });
    expect(scanTasks("## Phase 1\r\n\n- [ ] [T001] x\n")).toMatchObject({ kind: "mixed-eol" });
  });

  it("030:FR-006: a byte-order mark is unsafe", () => {
    expect(scanSpec(spec("917-bom"))).toMatchObject({ kind: "bom" });
    expect(scanTasks("﻿## Phase 1\n")).toMatchObject({ kind: "bom" });
  });

  it("030:FR-006: task, phase or Verify markup inside a code fence is unsafe", () => {
    expect(scanTasks(tasks("914-fenced"))).toMatchObject({ kind: "fenced-markup" });
  });

  it("030:FR-006: two Verify lines in one phase are unsafe", () => {
    expect(scanTasks(tasks("915-dup-verify"))).toMatchObject({ kind: "duplicate-verify" });
  });

  it("030:FR-006: a repeated task id in a phase is unsafe", () => {
    expect(scanTasks(tasks("916-dup-id"))).toMatchObject({ kind: "duplicate-task-id" });
  });

  it("030:FR-006: a heading priority that conflicts with a priority bullet is unsafe", () => {
    const text = "---\nfeature: x\n---\n\n### US-1 — S  (priority: P1)\n\n- **priority:** P2\n";
    expect(scanSpec(text)).toMatchObject({ kind: "conflicting-priority" });
  });

  it("030:FR-006: a clean 1.x spec and tasks file pass the scan", () => {
    expect(scanSpec("---\nfeature: x\n---\n\n### US-1 — S  (priority: P1)\n\n- **status:** done\n- **depends-on:** [US-2]\n")).toBeNull();
    expect(scanTasks("## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- **Verify:** `npm test` ✓ passed\n")).toBeNull();
  });

  it("030:FR-006: a spec with no frontmatter is not unsafe (it gets minimal frontmatter)", () => {
    expect(scanSpec("### US-1 — Story\n\n- **status:** done\n")).toBeNull();
  });
});

describe("content hash and read-back (030, FR-024, SC-010)", () => {
  it("030:FR-024: the hash is stable for equal text and changes with any byte", () => {
    expect(hashText("a\n")).toBe(hashText("a\n"));
    expect(hashText("a\n")).not.toBe(hashText("a\r\n"));
  });

  it("030:FR-024: a faithful v2 conversion reads back equal to the 1.x model", () => {
    const before = "---\nfeature: x\n---\n\n### US-1 — Story  (priority: P1)\n\n- **status:** done\n";
    const after = "---\nformat: 2\nfeature: x\nstories:\n  - id: US-1\n    priority: P1\n    status: done\n---\n\n### US-1 — Story\n";
    expect(specReadBack("x", before, after)).toEqual([]);
  });

  it("030:FR-024: a converter bug (wrong status) is caught by the spec read-back", () => {
    const before = "---\nfeature: x\n---\n\n### US-1 — Story\n\n- **status:** done\n";
    const after = "---\nformat: 2\nfeature: x\nstories:\n  - id: US-1\n    status: draft\n---\n\n### US-1 — Story\n";
    expect(specReadBack("x", before, after).join()).toMatch(/stories differs/);
  });

  it("030:FR-024: a converter bug (lost ownership) is caught by the tasks read-back", () => {
    const before = "## Phase 1\n\n- [ ] [T001] do it (src/a.ts)\n- **Verify:** `t` ✓ passed\n";
    const good = "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] do it\n```yaml\nfiles:\n  T001: [src/a.ts]\nverify:\n  check: \"`t`\"\n  result: passed\n```\n";
    const bad = good.replace("T001: [src/a.ts]", "T001: [src/other.ts]");
    expect(tasksReadBack(before, good)).toEqual([]);
    expect(tasksReadBack(before, bad).join()).toMatch(/tasks differs/);
  });

  it("030:FR-024: a converted file with a located YAML error is reported with file and line", () => {
    const before = "## Phase 1\n\n- [ ] [T001] do it (src/a.ts)\n";
    const after = "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] do it\n```yaml\nfiles: [\n```\n";
    expect(tasksReadBack(before, after).join()).toMatch(/tasks\.md:\d+ .*invalid YAML/);
  });
});

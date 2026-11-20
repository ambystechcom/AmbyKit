import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { parsePhases } from "../../src/core/markers.js";
import { convertTasks } from "../../src/core/migrate/convert-tasks.js";
import { readTasks } from "../../src/core/spec-format/dispatch.js";
import { phaseOut, taskOut } from "../helpers/spec-model.js";
import { fixture } from "../helpers/spec-project.js";

const V1 = fixture("edge-rich", "tasks.v1.md");
const v1Model = (text: string) => ({ tasks: parseTasks(text).map((t) => taskOut(t)), phases: parsePhases(text).map(phaseOut) });
const v2Model = (text: string) => {
  const r = readTasks(text);
  return { tasks: r.tasks.map((t) => taskOut(t, false)), phases: r.phases.map(phaseOut), issues: r.issues };
};

describe("convert 1.x tasks to v2 (030, US-3)", () => {
  it("030:FR-005: the converted edge-rich tasks read back equal to the 1.x model, with no error (T007's prose parenthetical is the one known warning)", () => {
    const r = convertTasks(V1);
    expect(r.status).toBe("converted");
    const back = v2Model(r.text);
    expect(back.tasks).toEqual(v1Model(V1).tasks);
    expect(back.phases).toEqual(v1Model(V1).phases);
    expect(back.issues.filter((i) => i.severity === "error")).toEqual([]);
    // 026:F-4: a task whose prose ends in a parenthetical that looks like a path keeps it as prose; the reader says so once
    expect(back.issues.map((i) => [i.kind, i.message.slice(0, 4)])).toEqual([["trailing-group-disagrees", "T007"]]);
  });

  it("030:FR-005: format: 2 is added, trailing groups leave the task lines, and the Verify line becomes the block's verify", () => {
    const r = convertTasks(V1);
    expect(r.text).toMatch(/^---\r?\nformat: 2\r?\n/);
    expect(r.text).not.toMatch(/\[T001\][^\n]*\(src\/a\.ts/);
    expect(r.text).not.toMatch(/^\s*(?:-\s*)?\*\*Verify:\*\*/m);
    expect(r.text).toMatch(/^```yaml/m);
    expect(r.filesMoved).toBeGreaterThan(3);
    expect(r.verifyMoved).toBeGreaterThan(1);
  });

  it("030:FR-005: checkboxes, markers, headings, checkpoints and prose are kept", () => {
    const r = convertTasks(V1);
    expect(r.text).toContain("> Line format note: a code span such as `- [ ] [T999] example` is prose, not a task.");
    expect(r.text).toMatch(/\[ \] \[T004\] \[US2\] Blocked one ⚠ BLOCKED: waiting on `\(src\/d\.ts\)` ↪ DEVIATION: did it differently/);
    expect(r.text).toContain("- **Checkpoint:** phase 2 demoable.");
    expect(r.text).toMatch(/^## Phase 3 — No verify/m);
  });

  it("030:FR-005: a failed result keeps its reason, an unverified result is kept, a passed one too", () => {
    const text = "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- **Verify:** `x` ✗ failed: 2 red\n\n## Phase 2\n\n- [ ] [T002] b\n- **Verify:** `y` ? unverified\n\n## Phase 3\n\n- [x] [T003] c\n- **Verify:** `z` ✓ passed\n";
    const r = convertTasks(text);
    expect(r.text).toContain('  check: "`x`"\n  result: failed\n  why: "2 red"'.replace(/\n/g, r.text.includes("\r\n") ? "\r\n" : "\n"));
    const back = v2Model(r.text);
    expect(back.phases.map((p) => [p.result, p.why])).toEqual([["failed", "2 red"], ["unverified", undefined], ["passed", undefined]]);
  });

  it("030:FR-005: a phase with owned tasks and no Verify line gets a files-only block after its last line", () => {
    const text = "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T002] b (src/b.ts)\n\n## Phase 2\n\n- [ ] [T003] c\n";
    const r = convertTasks(text);
    expect(r.text).toMatch(/- \[ \] \[T002\] b\r?\n\r?\n```yaml\r?\nfiles:\r?\n {2}T001: \["src\/a\.ts"\]\r?\n {2}T002: \["src\/b\.ts"\]\r?\n```/);
    expect(v2Model(r.text).tasks).toEqual(v1Model(text).tasks);
  });

  it("030:FR-009: converting a converted file changes nothing", () => {
    const once = convertTasks(V1);
    expect(convertTasks(once.text)).toMatchObject({ status: "unchanged", reason: "already v2", text: once.text });
  });

  it("030:FR-005: the file's line endings are kept", () => {
    const lf = V1.replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    const a = convertTasks(lf).text;
    const b = convertTasks(crlf).text;
    expect(a).not.toContain("\r");
    expect(b.split("\r\n").join("")).not.toMatch(/[\r\n]/);
    expect(v2Model(b).tasks).toEqual(v2Model(a).tasks);
  });

  it("030:FR-005: a file with no frontmatter gets minimal frontmatter, flagged; one with frontmatter just gains the marker", () => {
    const bare = convertTasks("## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n");
    expect(bare.addedFrontmatter).toBe(true);
    expect(bare.text.startsWith("---\nformat: 2\n---\n\n## Phase 1")).toBe(true);
    const fm = convertTasks("---\nfeature: x\n---\n\n## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n");
    expect(fm.addedFrontmatter).toBe(false);
    expect(fm.text.startsWith("---\nformat: 2\nfeature: x\n---\n")).toBe(true);
  });

  it("030:FR-005: a file with nothing to move still gets the format: 2 marker so it is recognized as v2", () => {
    const r = convertTasks("## Phase 1\n\n- [ ] [T001] a\n");
    expect(r.status).toBe("converted");
    expect(r.filesMoved).toBe(0);
    expect(readTasks(r.text).format).toBe(2);
    expect(convertTasks(r.text).status).toBe("unchanged");
  });

  it("030:FR-005: a glob owner moves to the block and reads back as a glob", () => {
    const r = convertTasks("## Phase 1\n\n- [ ] [T001] a (src/**/*.ts)\n");
    expect(v2Model(r.text).tasks[0]).toMatchObject({ paths: [], pathIssue: "glob" });
  });

  it("030:FR-023: dual-write keeps every 1.x line and adds the v2 blocks, and both read the same without disagreement warnings", () => {
    const r = convertTasks(V1, { dualWrite: true });
    expect(r.text).toContain("(src/a.ts, `src/b.ts`)");
    expect(r.text).toMatch(/\*\*Verify:\*\*/);
    const back = v2Model(r.text);
    expect(back.tasks).toEqual(v1Model(V1).tasks);
    expect(back.issues.filter((i) => /disagrees/.test(i.kind))).toEqual([]);
  });

  it("030:FR-006: a phase with two Verify lines is left unchanged (the safety scan reports it)", () => {
    expect(convertTasks(fixture("edge-rich", "tasks.dup-verify.v1.md"))).toMatchObject({ status: "unchanged" });
  });
});

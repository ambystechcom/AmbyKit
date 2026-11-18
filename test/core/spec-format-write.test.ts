import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { applyEdit, setStoryStatus, setTaskFiles, setVerifyResult, type EditOutcome } from "../../src/core/spec-format/write.js";
import { fixture } from "../helpers/spec-project.js";

const ok = (o: EditOutcome): string => {
  if (!o.ok) throw new Error(o.error);
  return o.text;
};
const lines = (t: string): string[] => t.split(/\r?\n/);
/** Lines that differ between two texts, as `[-old, +new]` pairs by position (same line count assumed unless noted). */
const changed = (a: string, b: string): number => lines(a).filter((l, i) => l !== lines(b)[i]).length;

const T1 = fixture("edge-rich", "tasks.v1.md");
const T2 = fixture("edge-rich", "tasks.v2-phase.md");
const T2TASK = fixture("edge-rich", "tasks.v2-task.md");
const S1 = fixture("edge-rich", "spec.v1.md");
const S2 = fixture("edge-rich", "spec.v2.md");

describe("writer: task files (030, US-10)", () => {
  it("030:FR-020: v2 phase block — an existing entry is replaced and nothing else changes", () => {
    const out = ok(setTaskFiles(T2, "T001", ["src/new.ts", "test/new.test.ts"]));
    expect(readTasks(out).tasks.find((t) => t.id === "T001")?.paths).toEqual(["src/new.ts", "test/new.test.ts"]);
    expect(changed(T2, out)).toBe(1);
    expect(readTasks(out).tasks.filter((t) => t.id !== "T001")).toEqual(readTasks(T2).tasks.filter((t) => t.id !== "T001"));
    expect(readTasks(out).phases).toEqual(readTasks(T2).phases);
  });

  it("030:FR-020: v2 — a task with no entry gets one added to the phase's files section", () => {
    const out = ok(setTaskFiles(T2, "T005", ["src/five.ts"]));
    expect(readTasks(out).tasks.find((t) => t.id === "T005")).toMatchObject({ paths: ["src/five.ts"] });
    expect(readTasks(out).tasks.find((t) => t.id === "T005")?.pathIssue).toBeUndefined();
    expect(lines(out).length).toBe(lines(T2).length + 1);
  });

  it("030:FR-020: v2 — a phase with no block gets a new files block after its last line", () => {
    const text = "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] a\n\n## Phase 2\n\n- [ ] [T002] b\n";
    const out = ok(setTaskFiles(text, "T002", ["src/b.ts"]));
    expect(readTasks(out).tasks.find((t) => t.id === "T002")?.paths).toEqual(["src/b.ts"]);
    expect(readTasks(out).tasks.find((t) => t.id === "T001")?.pathIssue).toBe("missing");
  });

  it("030:FR-020: v2 — a phase whose block only has verify gets a files section before it", () => {
    const text = "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] a\n```yaml\nverify:\n  check: \"x\"\n```\n";
    const out = ok(setTaskFiles(text, "T001", ["src/a.ts"]));
    expect(readTasks(out).tasks[0]?.paths).toEqual(["src/a.ts"]);
    expect(readTasks(out).phases[0]).toMatchObject({ check: "x" });
  });

  it("030:FR-020: the per-task layout is edited in place", () => {
    const out = ok(setTaskFiles(T2TASK, "T001", ["src/solo.ts"]));
    expect(readTasks(out).tasks.find((t) => t.id === "T001")?.paths).toEqual(["src/solo.ts"]);
    expect(changed(T2TASK, out)).toBe(1);
  });

  it("030:FR-020: 1.x — the trailing group is replaced and a marker after it stays last", () => {
    const out = ok(setTaskFiles(T1, "T004", ["src/changed.ts"]));
    const line = lines(out).find((l) => l.includes("[T004]")) ?? "";
    expect(line).toBe("- [ ] [T004] [US2] Blocked one (src/changed.ts) ⚠ BLOCKED: waiting on `(src/d.ts)` ↪ DEVIATION: did it differently");
    expect(changed(T1, out)).toBe(1);
    expect(readTasks(out).tasks.find((t) => t.id === "T004")).toMatchObject({ paths: ["src/changed.ts"], blocked: "waiting on `(src/d.ts)`" });
  });

  it("030:FR-020: 1.x — a task without a group gets one appended", () => {
    const out = ok(setTaskFiles(T1, "T005", ["src/five.ts"]));
    expect(lines(out).find((l) => l.includes("[T005]"))).toBe("- [ ] [T005] [US2] No ownership at all (src/five.ts)");
  });

  it("030:FR-020: refuses an unknown task, a glob, an empty list and an unusable path", () => {
    expect(setTaskFiles(T2, "T999", ["src/a.ts"])).toMatchObject({ ok: false, error: expect.stringMatching(/unknown task T999/) });
    expect(setTaskFiles(T2, "T001", ["src/**/*.ts"])).toMatchObject({ ok: false, error: expect.stringMatching(/glob/) });
    expect(setTaskFiles(T2, "T001", [])).toMatchObject({ ok: false });
    expect(setTaskFiles(T2, "T001", ["has space.ts"])).toMatchObject({ ok: false });
    expect(setTaskFiles(T2, "T001", ["noslashnodot"])).toMatchObject({ ok: false });
  });

  it("030:FR-020: refuses an ambiguous task id and a v2 file that already has errors", () => {
    const dup = "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T001] b (src/b.ts)\n";
    expect(setTaskFiles(dup, "T001", ["src/c.ts"])).toMatchObject({ ok: false, error: expect.stringMatching(/ambiguous/) });
    const broken = "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] a\n```yaml\nfiles: [\n```\n";
    expect(setTaskFiles(broken, "T001", ["src/a.ts"])).toMatchObject({ ok: false, error: expect.stringMatching(/fix the file first.*invalid YAML/) });
  });

  it("030:FR-020: line endings are kept (CRLF in, CRLF out)", () => {
    const crlf = T2.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    const out = ok(setTaskFiles(crlf, "T001", ["src/crlf.ts"]));
    expect(out.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("writer: Verify results (030, US-10)", () => {
  it("030:FR-020: v2 — result and why change inside the verify block and nothing else", () => {
    const out = ok(setVerifyResult(T2, 2, "passed"));
    expect(readTasks(out).phases.find((p) => p.phase === 2)).toMatchObject({ check: "first check", result: "passed" });
    expect(readTasks(out).phases.find((p) => p.phase === 2)?.why).toBeUndefined();
    expect(readTasks(out).tasks).toEqual(readTasks(T2).tasks);
  });

  it("030:FR-020: v2 — failed keeps a reason that reads back, and failed then passed removes it", () => {
    const failed = ok(setVerifyResult(T2, 1, "failed", "3 red"));
    expect(readTasks(failed).phases.find((p) => p.phase === 1)).toMatchObject({ result: "failed", why: "3 red" });
    const fixed = ok(setVerifyResult(failed, 1, "passed"));
    expect(readTasks(fixed).phases.find((p) => p.phase === 1)).toMatchObject({ result: "passed" });
    expect(fixed).not.toContain("3 red");
  });

  it("030:FR-020: v2 — a reason with quotes and colons survives", () => {
    const out = ok(setVerifyResult(T2, 1, "failed", 'it said "no": retry'));
    expect(readTasks(out).phases.find((p) => p.phase === 1)?.why).toBe('it said "no": retry');
  });

  it("030:FR-020: v2 — a result is added when the block had none, and unverified is allowed", () => {
    const text = "---\nformat: 2\n---\n## Phase 1\n\n- [x] [T001] a\n```yaml\nverify:\n  check: \"x\"\n```\n";
    const out = ok(setVerifyResult(text, 1, "unverified"));
    expect(readTasks(out).phases[0]).toMatchObject({ check: "x", result: "unverified" });
  });

  it("030:FR-020: 1.x — the result suffix on the Verify line is rewritten and the check is kept", () => {
    const out = ok(setVerifyResult(T1, 1, "failed", "2 red"));
    expect(lines(out).filter((l) => l.includes("**Verify:** `npm test` passes"))).toEqual(["- **Verify:** `npm test` passes ✗ failed: 2 red"]);
    expect(changed(T1, out)).toBe(1);
    expect(readTasks(out).phases.find((p) => p.phase === 1)).toMatchObject({ check: "`npm test` passes", result: "failed", why: "2 red" });
    const back = ok(setVerifyResult(out, 1, "passed"));
    expect(lines(back).find((l) => l.includes("`npm test` passes"))).toBe("- **Verify:** `npm test` passes ✓ passed");
  });

  it("030:FR-020: refuses an unknown phase, an invalid result, and a phase with no Verify check", () => {
    expect(setVerifyResult(T2, 99, "passed")).toMatchObject({ ok: false, error: expect.stringMatching(/unknown phase 99/) });
    expect(setVerifyResult(T2, 1, "maybe")).toMatchObject({ ok: false, error: expect.stringMatching(/invalid result/) });
    expect(setVerifyResult(T2, 3, "passed")).toMatchObject({ ok: false, error: expect.stringMatching(/no Verify check/) });
    expect(setVerifyResult(T1, 3, "passed")).toMatchObject({ ok: false, error: expect.stringMatching(/no Verify check/) });
  });
});

describe("writer: story status (030, US-10)", () => {
  it("030:FR-020: v2 — the status line in frontmatter changes and nothing else", () => {
    const out = ok(setStoryStatus(S2, "900-edge-rich", "US-3", "in-progress"));
    expect(readSpec("900-edge-rich", out).stories.find((s) => s.id === "US3")?.status).toBe("in-progress");
    expect(readSpec("900-edge-rich", out).stories.filter((s) => s.id !== "US3")).toEqual(readSpec("900-edge-rich", S2).stories.filter((s) => s.id !== "US3"));
    expect(changed(S2, out)).toBe(1);
  });

  it("030:FR-020: v2 — a story with no status line gets one at the end of its entry", () => {
    const out = ok(setStoryStatus(S2, "900-edge-rich", "US-4", "ready"));
    expect(readSpec("900-edge-rich", out).stories.find((s) => s.id === "US4")?.status).toBe("ready");
    expect(lines(out).length).toBe(lines(S2).length + 1);
  });

  it("030:FR-020: 1.x — the status bullet changes and nothing else", () => {
    const out = ok(setStoryStatus(S1, "900-edge-rich", "US-2", "done"));
    expect(readSpec("900-edge-rich", out).stories.find((s) => s.id === "US2")?.status).toBe("done");
    expect(changed(S1, out)).toBe(1);
  });

  it("030:FR-020: 1.x — a story with no status bullet gets one after its metadata", () => {
    const text = "---\nfeature: x\n---\n\n### US-1 — A\n\n- **depends-on:** []\n\n### US-2 — B\n";
    const out = ok(setStoryStatus(text, "x", "US1", "ready"));
    expect(readSpec("x", out).stories.find((s) => s.id === "US1")?.status).toBe("ready");
    expect(readSpec("x", out).stories.find((s) => s.id === "US2")?.status).toBe("");
  });

  it("030:FR-020: refuses an unknown story, an invalid status, and a story missing from the frontmatter", () => {
    expect(setStoryStatus(S2, "900-edge-rich", "US-9", "done")).toMatchObject({ ok: false, error: expect.stringMatching(/unknown story US-9/) });
    expect(setStoryStatus(S2, "900-edge-rich", "US-1", "finished")).toMatchObject({ ok: false, error: expect.stringMatching(/invalid status/) });
    const missing = "---\nformat: 2\nstories:\n  - id: US-1\n---\n\n### US-1 — A\n\n### US-2 — B\n";
    expect(setStoryStatus(missing, "x", "US-2", "done")).toMatchObject({ ok: false, error: expect.stringMatching(/not in the frontmatter/) });
  });
});

describe("applyEdit: read-back and restore (030, FR-020)", () => {
  it("030:FR-020: writes the edit and returns the summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-030-write-"));
    const file = join(dir, "tasks.md");
    writeFileSync(file, T2);
    const out = applyEdit(file, (t) => setTaskFiles(t, "T001", ["src/disk.ts"]));
    expect(out).toMatchObject({ ok: true, summary: "T001 files set: src/disk.ts" });
    expect(readTasks(readFileSync(file, "utf8")).tasks.find((t) => t.id === "T001")?.paths).toEqual(["src/disk.ts"]);
  });

  it("030:FR-020: a refused edit leaves the file byte-identical", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-030-write-"));
    const file = join(dir, "tasks.md");
    writeFileSync(file, T2);
    const out = applyEdit(file, (t) => setTaskFiles(t, "T999", ["src/x.ts"]));
    expect(out.ok).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(T2);
  });

  it("030:FR-020: a missing file is refused", () => {
    expect(applyEdit(join(tmpdir(), "ambykit-no-such-file.md"), (t) => setTaskFiles(t, "T001", ["src/x.ts"]))).toMatchObject({ ok: false });
  });
});

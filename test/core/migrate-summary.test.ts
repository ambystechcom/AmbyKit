import { describe, expect, it } from "vitest";
import { lineDelta, summarize, unifiedDiff, type MigrateRecord } from "../../src/core/migrate/summary.js";

const records: MigrateRecord[] = [
  { feature: "020-blocked", file: "spec.md", status: "converted", add: 12, del: 9, notes: ["stripped 4 priority annotations"] },
  { feature: "020-blocked", file: "tasks.md", status: "converted", add: 30, del: 22, notes: ["added minimal frontmatter"] },
  { feature: "021-tests", file: "spec.md", status: "unchanged", reason: "already v2" },
  { feature: "021-tests", file: "tasks.md", status: "skipped", reason: "phase 2 has 2 Verify lines", fix: "keep one Verify line per phase" },
  { feature: "022-adr", file: "spec.md", status: "unchanged", reason: "no stories" },
];

describe("line delta (030, FR-008)", () => {
  it("030:FR-008: counts added and removed lines as a multiset, so a moved line is neither", () => {
    expect(lineDelta("a\nb\nc\n", "a\nb\nc\n")).toEqual({ add: 0, del: 0 });
    expect(lineDelta("a\nb\nc", "a\nX\nc\nd")).toEqual({ add: 2, del: 1 });
    expect(lineDelta("a\nb\nc", "c\nb\na")).toEqual({ add: 0, del: 0 });
  });

  it("030:FR-008: CRLF and LF count the same", () => {
    expect(lineDelta("a\r\nb\r\n", "a\nb\nc\n")).toEqual({ add: 1, del: 0 });
  });
});

describe("unified diff (030, FR-007)", () => {
  it("030:FR-007: identical texts give an empty diff", () => {
    expect(unifiedDiff("specs/x/spec.md", "a\nb\n", "a\nb\n")).toBe("");
  });

  it("030:FR-007: a change shows headers, a hunk marker, context and the -/+ lines", () => {
    const d = unifiedDiff("specs/x/tasks.md", "one\ntwo\nthree\nfour\nfive\n", "one\ntwo\n3\nfour\nfive\n");
    expect(d.split("\n")).toEqual(["--- a/specs/x/tasks.md", "+++ b/specs/x/tasks.md", "@@ -1,5 +1,5 @@", " one", " two", "-three", "+3", " four", " five"]);
  });

  it("030:FR-007: far-apart changes make separate hunks, close ones merge", () => {
    const base = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const edited = [...base];
    edited[2] = "CHANGED 3";
    edited[27] = "CHANGED 28";
    const far = unifiedDiff("f", base.join("\n"), edited.join("\n"));
    expect(far.match(/^@@/gm)).toHaveLength(2);
    const near = [...base];
    near[2] = "CHANGED 3";
    near[5] = "CHANGED 6";
    expect(unifiedDiff("f", base.join("\n"), near.join("\n")).match(/^@@/gm)).toHaveLength(1);
  });

  it("030:FR-007: additions at the start and deletions at the end are shown with sane ranges", () => {
    const add = unifiedDiff("f", "b\nc", "a\nb\nc");
    expect(add).toContain("+a");
    expect(add).toMatch(/@@ -1,\d+ \+1,\d+ @@/);
    const del = unifiedDiff("f", "a\nb\nc", "a\nb");
    expect(del).toContain("-c");
  });

  it("030:FR-007: the diff is deterministic", () => {
    const a = "x\ny\nz\n";
    const b = "x\nQ\nz\nw\n";
    expect(unifiedDiff("f", a, b)).toBe(unifiedDiff("f", a, b));
  });
});

describe("migrate summary (030, FR-007, FR-008)", () => {
  it("030:FR-008: lists each feature with its files, +added -removed lines, notes, skips and the fix for each skip", () => {
    const s = summarize(records);
    expect(s).toContain("020-blocked  (+42 -31)");
    expect(s).toMatch(/spec\.md {2}converted {2}\+12 -9 {2}\(stripped 4 priority annotations\)/);
    expect(s).toMatch(/tasks\.md converted {2}\+30 -22 {2}\(added minimal frontmatter\)/);
    expect(s).toMatch(/tasks\.md SKIPPED {2}untouched: phase 2 has 2 Verify lines/);
    expect(s).toContain("fix: keep one Verify line per phase");
    expect(s).toMatch(/spec\.md {2}unchanged {2}\(already v2\)/);
  });

  it("030:FR-008: the total line counts converted, unchanged and skipped files and the lines", () => {
    expect(summarize(records)).toContain("Total: 2 converted, 2 unchanged, 1 skipped (left untouched) — +42 -31 lines");
  });

  it("030:FR-007: a dry run says nothing was written and uses would-convert wording", () => {
    const s = summarize(records, { dryRun: true });
    expect(s.split("\n")[0]).toBe("Dry run: nothing was written. This is what migrate would do.");
    expect(s).toContain("would convert");
    expect(s).not.toMatch(/ converted {2}\+/);
    expect(s).toContain("Total: 2 to convert");
  });

  it("030:FR-007: --diff appends each converted file's unified diff", () => {
    const withText: MigrateRecord[] = [{ feature: "020-b", file: "spec.md", status: "converted", add: 1, del: 1, before: "a\nb\n", after: "a\nB\n" }];
    const s = summarize(withText, { diff: true });
    expect(s).toContain("--- a/specs/020-b/spec.md");
    expect(s).toContain("-b");
    expect(s).toContain("+B");
    expect(summarize(withText)).not.toContain("--- a/");
  });

  it("030:FR-008: output is deterministic and keeps the given order", () => {
    expect(summarize(records)).toBe(summarize([...records]));
    const s = summarize(records);
    expect(s.indexOf("020-blocked")).toBeLessThan(s.indexOf("021-tests"));
    expect(s.indexOf("021-tests")).toBeLessThan(s.indexOf("022-adr"));
  });

  it("030:FR-014: an empty run still prints a total", () => {
    expect(summarize([])).toContain("Total: 0 converted, 0 unchanged, 0 skipped (left untouched) — +0 -0 lines");
  });
});

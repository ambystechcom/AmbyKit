import { describe, expect, it } from "vitest";
import { readFrontmatter } from "../../src/core/spec-format/frontmatter.js";
import type { FormatIssue } from "../../src/core/spec-format/model.js";

describe("frontmatter reader (030, T011)", () => {
  it("030:FR-001: parses a closed block and reports 1-based line numbers", () => {
    const issues: FormatIssue[] = [];
    const fm = readFrontmatter("---\nformat: 2\nfeature: 030-x\n---\n\n# Body\n", "spec.md", issues);
    expect(fm.present).toBe(true);
    expect(fm.data).toEqual({ format: 2, feature: "030-x" });
    expect([fm.start, fm.end]).toEqual([2, 4]);
    expect(issues).toEqual([]);
  });

  it("030:FR-003: invalid YAML is a located issue and never a throw", () => {
    const issues: FormatIssue[] = [];
    const fm = readFrontmatter("---\nfeature: ok\nstories: [\n---\nbody\n", "spec.md", issues);
    expect(fm.data).toEqual({});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: "spec.md", severity: "error", kind: "bad-yaml" });
    expect(issues[0]?.line).toBeGreaterThanOrEqual(2);
  });

  it("030:FR-003: an unclosed block is an issue at line 1", () => {
    const issues: FormatIssue[] = [];
    const fm = readFrontmatter("---\nfeature: x\nno closing fence\n", "spec.md", issues);
    expect(fm.present).toBe(false);
    expect(issues[0]).toMatchObject({ line: 1, kind: "frontmatter-unclosed" });
  });

  it("030:FR-012: a file with no frontmatter has none, without an issue", () => {
    const issues: FormatIssue[] = [];
    const fm = readFrontmatter("### US-1 — Story\n", "spec.md", issues);
    expect(fm).toMatchObject({ present: false, data: {} });
    expect(issues).toEqual([]);
  });

  it("030:FR-001: CRLF text parses the same as LF", () => {
    const issues: FormatIssue[] = [];
    const fm = readFrontmatter("---\r\nformat: 2\r\n---\r\n", "spec.md", issues);
    expect(fm.data).toEqual({ format: 2 });
  });
});

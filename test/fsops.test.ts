import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyFiles } from "../src/cli/fsops.js";
import type { EmittedFile } from "../src/core/types.js";

const OPTS = { dryRun: false, includeUser: false } as const;

describe("applyFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ambykit-fsops-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const file = (contents: string): EmittedFile => ({
    path: "gen/output.md",
    contents,
    scope: "project",
  });

  it("creates a missing file and reports it as created", () => {
    const result = applyFiles(root, [file("hello\n")], OPTS);
    expect(result.created).toContain("gen/output.md");
    expect(readFileSync(join(root, "gen", "output.md"), "utf8")).toBe("hello\n");
  });

  it("treats a CRLF checkout of identical content as unchanged (git autocrlf)", () => {
    applyFiles(root, [file("line one\nline two\n")], OPTS);
    // Simulate git autocrlf rewriting the checked-out file with CRLF endings.
    writeFileSync(join(root, "gen", "output.md"), "line one\r\nline two\r\n", "utf8");

    const check = applyFiles(root, [file("line one\nline two\n")], { ...OPTS, dryRun: true });
    expect(check.wouldChange).toEqual([]);
    expect(check.unchanged).toContain("gen/output.md");
  });

  it("still detects real content drift regardless of line endings", () => {
    applyFiles(root, [file("original\n")], OPTS);
    writeFileSync(join(root, "gen", "output.md"), "edited by hand\r\n", "utf8");

    const check = applyFiles(root, [file("original\n")], { ...OPTS, dryRun: true });
    expect(check.wouldChange).toContain("gen/output.md");
  });
});

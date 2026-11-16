import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyFiles } from "../src/cli/io/fsops.js";
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

describe("applyFiles: merge json (feature 025)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ambykit-fsops-json-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const entry = { type: "stdio", command: "ambykit", args: ["mcp"] };
  const mcp = (path = ".mcp.json", key = "mcpServers"): EmittedFile => ({
    path,
    contents: JSON.stringify({ [key]: { ambykit: entry } }, null, 2) + "\n",
    scope: "project",
    merge: "json",
  });

  it("025:FR-019: creates the file when absent, then a second run changes nothing", () => {
    const first = applyFiles(root, [mcp()], OPTS);
    expect(first.created).toEqual([".mcp.json"]);
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"))).toEqual({ mcpServers: { ambykit: entry } });
    const second = applyFiles(root, [mcp()], OPTS);
    expect(second.unchanged).toEqual([".mcp.json"]);
    expect(second.written).toEqual([]);
  });

  it("025:FR-019: adds only the ambykit entry to an existing file, preserving the user's servers, and backs it up", () => {
    const original = JSON.stringify({ mcpServers: { mine: { command: "x" } }, other: true }, null, 2) + "\n";
    writeFileSync(join(root, ".mcp.json"), original);
    const result = applyFiles(root, [mcp()], OPTS);
    expect(result.updated).toEqual([".mcp.json"]);
    expect(result.backedUp).toHaveLength(1);
    expect(readFileSync(join(root, result.backedUp[0]!), "utf8")).toBe(original);
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"))).toEqual({ mcpServers: { mine: { command: "x" }, ambykit: entry }, other: true });
  });

  it("025:FR-018: a file that is not plain JSON is skipped, reported and left byte-identical", () => {
    const commented = '{\n  // hand written\n  "mcp": {}\n}\n';
    writeFileSync(join(root, "opencode.json"), commented);
    const result = applyFiles(root, [mcp("opencode.json", "mcp")], OPTS);
    expect(result.skippedJson).toEqual([{ path: "opencode.json", reason: expect.stringMatching(/not plain JSON/) }]);
    expect(result.written).toEqual([]);
    expect(readFileSync(join(root, "opencode.json"), "utf8")).toBe(commented);
  });

  it("025:FR-019: a dry run reports what would change and writes nothing", () => {
    const result = applyFiles(root, [mcp()], { dryRun: true, includeUser: false });
    expect(result.wouldChange).toEqual([".mcp.json"]);
    expect(() => readFileSync(join(root, ".mcp.json"), "utf8")).toThrow();
  });

  it("025:FR-018: a user-scope MCP file is skipped without consent, like any user-level file", () => {
    const user: EmittedFile = { ...mcp(".copilot/mcp-config.json"), scope: "user" };
    const result = applyFiles(root, [user], OPTS);
    expect(result.skipped).toEqual([".copilot/mcp-config.json"]);
  });
});

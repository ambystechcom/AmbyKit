import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";

const SPEC = [
  "---",
  "feature: 001-demo",
  "status: ready",
  "---",
  "# Demo",
  "",
  "### US-1 — One  (priority: P1)",
  "",
  "- **status:** draft",
  "",
  "**Acceptance criteria**",
  "- Given a, When b, Then c.",
  "",
  "## Requirements (EARS)",
  "",
  "- FR-001  THE SYSTEM SHALL do one.",
  "",
].join("\n");

const TASKS = "---\nfeature: x\n---\n\n## Phase 1\n\n- [ ] [T001] [US1] Alpha (src/a.ts)\n- **Verify:** `true`\n";

/** A project with the given feature directories; `tests` maps a directory to the content of its tests.md. */
function project(dirs: string[], tests: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-021-adopt-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  for (const dir of dirs) {
    const d = join(root, "specs", dir);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "spec.md"), SPEC.replace("001-demo", dir));
    writeFileSync(join(d, "tasks.md"), TASKS);
    if (tests[dir] !== undefined) writeFileSync(join(d, "tests.md"), tests[dir]);
  }
  return root;
}

type Cmd = { run(ctx: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> };

async function analyze(cwd: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await (new AnalyzeCommand() as Cmd).run({ cwd, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

const DESIGNED = "## Cases\n- [TC-001] [US-1#1] [FR-001] auto — one → ok\n";

describe("features without a tests.md read exactly as before (spec 021, US-7)", () => {
  it("021:FR-015: a project with no tests.md has no testDesign key and no test-design text", async () => {
    const root = project(["001-a", "002-b"]);
    const json = JSON.parse((await analyze(root, { json: true })).out) as Record<string, unknown>;
    expect(json).not.toHaveProperty("testDesign");
    const text = await analyze(root);
    expect(text.out).not.toMatch(/test design/i);
    expect(text.code).toBe(0);
  });

  it("021:FR-015: the output is identical whether or not other projects use test design", async () => {
    const plain = await analyze(project(["001-a", "002-b"]));
    const alsoPlain = await analyze(project(["001-a", "002-b"]));
    expect(alsoPlain.out).toBe(plain.out);
    expect(alsoPlain.code).toBe(plain.code);
  });

  it("021:FR-015: once one feature has a tests.md, features without one appear only under `missing` in --json", async () => {
    const root = project(["001-a", "002-b"], { "001-a": DESIGNED });
    const json = JSON.parse((await analyze(root, { json: true })).out) as { testDesign: { findings: unknown[]; missing: string[] } };
    expect(json.testDesign).toEqual({ findings: [], missing: ["002"] });
    const text = await analyze(root);
    expect(text.out).not.toMatch(/002.*test design|test design.*002/i);
    expect(text.out).not.toContain("Test design findings");
  });

  it("021:FR-015: test-design findings never change the exit status", async () => {
    const withGaps = project(["001-a"], { "001-a": "## Cases\n- [TC-001] [US-1#1] [FR-099] auto — one → ok\n" });
    const without = project(["001-a"]);
    const a = await analyze(withGaps);
    expect(a.out).toContain("Test design findings");
    expect(a.code).toBe((await analyze(without)).code);
  });

  it("021:FR-016: a skipped design (`skipped: <reason>`) is valid and silent", async () => {
    const root = project(["001-a"], { "001-a": "skipped: documentation only\n" });
    const text = await analyze(root);
    expect(text.out).not.toContain("Test design findings");
    const json = JSON.parse((await analyze(root, { json: true })).out) as { testDesign: { findings: unknown[]; missing: string[] } };
    expect(json.testDesign.findings).toEqual([]);
    expect(json.testDesign.missing).toEqual([]);
  });
});

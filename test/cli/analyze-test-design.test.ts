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
  "- Given d, When e, Then f.",
  "",
  "## Requirements (EARS)",
  "",
  "- FR-001  THE SYSTEM SHALL do one.",
  "- FR-002  THE SYSTEM SHALL do two.",
  "",
].join("\n");

const TASKS = "---\nfeature: x\n---\n\n## Phase 1\n\n- [ ] [T001] [US1] Alpha (src/a.ts)\n";

/** Two features: 001 has a tests.md (with `designFindings` choosing what is wrong), 002 has none. */
function project(tests: string | null): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-021-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  for (const [dir, withTests] of [["001-demo", true], ["002-plain", false]] as const) {
    const d = join(root, "specs", dir);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "spec.md"), SPEC.replace("001-demo", dir));
    writeFileSync(join(d, "tasks.md"), TASKS);
    if (withTests && tests !== null) writeFileSync(join(d, "tests.md"), tests);
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

const COMPLETE = [
  "## Cases",
  "- [TC-001] [US-1#1] [FR-001] auto — first → one",
  "- [TC-002] [US-1#2] [FR-002] auto — second → two",
].join("\n");

const WITH_GAPS = [
  "## Cases",
  "- [TC-001] [US-1#1] [FR-001] auto — first → one",
  "- [TC-002] [US-1#9] [FR-077] auto — second → two",
].join("\n");

describe("analyze reports test-design findings (spec 021, US-3)", () => {
  it("021:FR-007: names the uncovered requirement and the unknown ids, for the feature that has a tests.md only", async () => {
    const { out } = await analyze(project(WITH_GAPS));
    expect(out).toContain("Test design findings (tests.md):");
    expect(out).toContain("001 — uncovered-fr");
    expect(out).toContain("FR-002 has no case");
    expect(out).toContain("unknown-id");
    const section = out.slice(out.indexOf("Test design findings"), out.indexOf("Buildable now"));
    expect(section).toContain("001 — ");
    expect(section).not.toMatch(/\b002 — /); // 002 has no tests.md: it is never printed here
  });

  it("021:FR-008: findings are warnings: the exit status stays 0", async () => {
    expect((await analyze(project(WITH_GAPS))).code).toBe(0);
    expect((await analyze(project(WITH_GAPS), { json: true })).code).toBe(0);
  });

  it("021:FR-012: --json carries `testDesign` with findings (kind, ref, line) and the features with no tests.md", async () => {
    const { out } = await analyze(project(WITH_GAPS), { json: true });
    const report = JSON.parse(out) as {
      testDesign: { findings: Array<{ feature: string; kind: string; ref?: string; line?: number }>; missing: string[] };
    };
    expect(report.testDesign.missing).toEqual(["002"]);
    const kinds = report.testDesign.findings.map((f) => f.kind);
    expect(kinds).toContain("uncovered-fr");
    expect(kinds).toContain("unknown-id");
    expect(report.testDesign.findings.every((f) => f.feature === "001")).toBe(true);
    expect(report.testDesign.findings.find((f) => f.kind === "unknown-id")?.line).toBeGreaterThan(0);
  });

  it("021:FR-007: a complete design prints no findings but is still recorded in --json", async () => {
    const text = await analyze(project(COMPLETE));
    expect(text.out).not.toContain("Test design findings");
    const json = JSON.parse((await analyze(project(COMPLETE), { json: true })).out) as {
      testDesign: { findings: unknown[]; missing: string[] };
    };
    expect(json.testDesign).toEqual({ findings: [], missing: ["002"] });
  });

  it("021:FR-016: a skipped design is valid and prints nothing", async () => {
    const text = await analyze(project("skipped: tiny change\n"));
    expect(text.out).not.toContain("Test design findings");
    expect(text.code).toBe(0);
  });
});

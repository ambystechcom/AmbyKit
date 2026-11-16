import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";

const SPEC = "---\nfeature: 001-demo\nstatus: ready\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n\n**Acceptance criteria**\n- Given a, When b, Then c.\n\n## Requirements (EARS)\n\n- FR-001  THE SYSTEM SHALL do one.\n";
const TASKS = "---\nfeature: x\n---\n\n## Phase 1\n\n- [ ] [T001] [US1] Alpha (src/a.ts)\n";
const rec = (id: string, extra = "") => `---\nid: ${id}\ntitle: ${id} title\nstatus: accepted\ndate: 2026-11-16\n${extra}---\n\n# t\n`;

function project(opts: { plan?: string; records?: Record<string, string>; index?: string } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-022-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const d = join(root, "specs", "001-demo");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "spec.md"), SPEC);
  writeFileSync(join(d, "tasks.md"), TASKS);
  if (opts.plan !== undefined) writeFileSync(join(d, "plan.md"), opts.plan);
  if (opts.records) {
    mkdirSync(join(root, ".amby", "decisions"), { recursive: true });
    for (const [id, text] of Object.entries(opts.records)) writeFileSync(join(root, ".amby", "decisions", `${id}.md`), text);
    if (opts.index !== undefined) writeFileSync(join(root, ".amby", "decisions", "README.md"), opts.index);
  }
  return root;
}

type Cmd = { run(ctx: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> };

export async function analyze(cwd: string, flags: Record<string, string | boolean> = {}) {
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

describe("ambykit analyze — decision records (feature 022)", () => {
  it("reports a dangling ADR citation as an error and exits non-zero (FR-007, SC-002)", async () => {
    const root = project({ plan: "We follow ADR-007 here.\n" });
    const r = await analyze(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain("[dangling-citation]");
    expect(r.out).toContain("ADR-007");
    expect(r.out).toContain("specs/001-demo/plan.md");
    const j = await analyze(root, { json: true });
    expect(j.code).toBe(1);
    expect(JSON.parse(j.out).decisions.issues[0]).toMatchObject({ kind: "dangling-citation", level: "error", ids: ["ADR-007"] });
  });

  it("a resolved citation with a complete index is clean and exits zero", async () => {
    const root = project({ plan: "See ADR-001.\n", records: { "ADR-001": rec("ADR-001") }, index: "| ADR-001 | t | accepted |\n" });
    const r = await analyze(root);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("Decision records");
    const json = JSON.parse((await analyze(root, { json: true })).out);
    expect(json.decisions).toEqual({ records: [{ id: "ADR-001", title: "ADR-001 title", status: "accepted" }], issues: [] });
  });

  it("index drift is a warning only: printed, exit status unchanged (FR-006)", async () => {
    const root = project({ records: { "ADR-001": rec("ADR-001") }, index: "# Decisions\n" });
    const r = await analyze(root);
    expect(r.code).toBe(0);
    expect(r.out).toContain("[index-drift]");
  });

  it("a supersede mismatch or accepted-with-conflict fails the exit status", async () => {
    const mismatch = project({ records: { "ADR-001": rec("ADR-001"), "ADR-002": rec("ADR-002", "supersedes: ADR-001\n") }, index: "ADR-001 ADR-002" });
    expect((await analyze(mismatch)).code).toBe(1);
    const conflict = project({ records: { "ADR-001": rec("ADR-001", "conflicts: [3]\n") }, index: "ADR-001" });
    const r = await analyze(conflict);
    expect(r.code).toBe(1);
    expect(r.out).toContain("[accepted-with-conflict]");
  });
});

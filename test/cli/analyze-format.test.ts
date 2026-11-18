import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { runCommand } from "../helpers/run-command.js";
import { fixture, tempProject } from "../helpers/spec-project.js";

const analyze = (dir: string, flags: Record<string, string | boolean> = {}) => runCommand(new AnalyzeCommand(), dir, [], flags);

describe("analyze reports spec format issues (030, US-1)", () => {
  it("030:FR-003: a broken v2 spec is listed with file and line in text, and exits 1", async () => {
    const dir = tempProject({ "901-bad": { "spec.md": fixture("malformed", "bad-frontmatter.spec.md") } });
    const r = await analyze(dir);
    expect(r.out + r.err).toMatch(/Spec format issues:/);
    expect(r.out + r.err).toMatch(/specs\/901-bad\/spec\.md:\d+ — \[bad-yaml\]/);
    expect(r.code).toBe(1);
  });

  it("030:FR-013: --json carries an additive formatIssues key with the located issues", async () => {
    const dir = tempProject({ "901-bad": { "spec.md": fixture("malformed", "bad-frontmatter.spec.md") } });
    const r = await analyze(dir, { json: true });
    const report = JSON.parse(r.out) as { formatIssues?: { file: string; line: number; severity: string; kind: string; message: string }[] };
    expect(report.formatIssues?.[0]).toMatchObject({ file: "specs/901-bad/spec.md", severity: "error", kind: "bad-yaml" });
    expect(report.formatIssues?.[0]?.line).toBeGreaterThanOrEqual(2);
    expect(r.code).toBe(1);
  });

  it("030:FR-003: warnings are listed but never change the exit status", async () => {
    const text = "---\nfeature: 902-warn\nstories:\n  - id: US-1\n    status: made-up\n---\n\n### US-1 — Story\n";
    const dir = tempProject({ "902-warn": { "spec.md": text } });
    const r = await analyze(dir);
    expect(r.out + r.err).toMatch(/missing-format-marker/);
    expect(r.out + r.err).toMatch(/unknown-status/);
    expect(r.code).toBe(0);
  });

  it("030:FR-018: a 1.x-only project reports no formatIssues key and the same text as before", async () => {
    const dir = tempProject({
      "904-old": {
        "spec.md": "---\nfeature: 904-old\n---\n\n### US-1 — Story\n\n- **status:** done\n",
        "tasks.md": "## Phase 1 — Setup\n\n- [x] [T001] [US-1] do it (src/a.ts)\n",
      },
    });
    const r = await analyze(dir, { json: true });
    expect(JSON.parse(r.out)).not.toHaveProperty("formatIssues");
    const t = await analyze(dir);
    expect(t.out + t.err).not.toMatch(/Spec format issues/);
  });
});

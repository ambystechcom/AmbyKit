import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { runCommand } from "../helpers/run-command.js";
import { tempProject } from "../helpers/spec-project.js";

const SPEC = "---\nformat: 2\nfeature: 001-demo\nstories:\n  - id: US-1\n    status: in-progress\n---\n\n### US-1 — One\n";

/** One v2 feature: phase 1 verified `p1`, phase 2 `p2`, phase 3 without a verify block (all tasks open). */
function tasks(p1: string, p2: string): string {
  return [
    "---",
    "format: 2",
    "feature: 001-demo",
    "---",
    "",
    "## Phase 1",
    "",
    "- [x] [T001] [US1] Alpha",
    "```yaml",
    "files:",
    "  T001: [src/a.ts]",
    "verify:",
    "  check: \"`a` passes\"",
    p1,
    "```",
    "",
    "## Phase 2",
    "",
    "- [ ] [T002] [US1] Beta",
    "```yaml",
    "files:",
    "  T002: [src/b.ts]",
    "verify:",
    "  check: \"`b` passes\"",
    p2,
    "```",
    "",
    "## Phase 3",
    "",
    "- [ ] [T003] [US1] Gamma",
    "```yaml",
    "files:",
    "  T003: [src/c.ts]",
    "```",
    "",
  ].join("\n");
}

const project = (p1: string, p2: string) => tempProject({ "001-demo": { "spec.md": SPEC, "tasks.md": tasks(p1, p2) } });
const json = async (cmd: AnalyzeCommand | DashboardCommand, dir: string, flags: Record<string, string | boolean>) =>
  JSON.parse((await runCommand(cmd, dir, [], flags)).out);

describe("a v2 phase's latest Verify drives analyze and the dashboard as in 020 (030, US-2)", () => {
  it("030:FR-002: a failed result is a verifyIssue with its reason; a phase with no verify block is a missing one", async () => {
    const dir = project("  result: passed", "  result: failed\n  why: 2 red");
    const report = await json(new AnalyzeCommand(), dir, { json: true });
    const failed = report.verifyIssues.filter((v: { kind: string }) => v.kind === "failed");
    expect(failed).toEqual([expect.objectContaining({ phase: "001:phase-2", why: "2 red" })]);
    expect(report.verifyIssues.some((v: { kind: string; phase: string }) => v.kind === "missing" && v.phase === "001:phase-3")).toBe(true);
  });

  it("030:FR-002: the dashboard overview counts verified, failed and missing phases and raises a verify-failed attention item", async () => {
    const dir = project("  result: passed", "  result: failed\n  why: 2 red");
    const doc = await json(new DashboardCommand(), dir, { json: true, overview: true });
    expect(doc.features[0].verify).toEqual({ verified: 1, failed: 1, missing: 1 });
    expect(doc.attention).toContainEqual(expect.objectContaining({ key: "001:phase-2", kind: "verify-failed", reason: "verify failed: 2 red" }));
  });

  it("030:FR-002: failed then passed — the later result wins and the failure is no longer current", async () => {
    const failedDir = project("  result: passed", "  result: failed\n  why: 2 red");
    const before = await json(new AnalyzeCommand(), failedDir, { json: true });
    expect(before.verifyIssues.some((v: { kind: string }) => v.kind === "failed")).toBe(true);
    const fixedDir = project("  result: passed", "  result: passed");
    const after = await json(new AnalyzeCommand(), fixedDir, { json: true });
    expect(after.verifyIssues.some((v: { kind: string }) => v.kind === "failed")).toBe(false);
    const doc = await json(new DashboardCommand(), fixedDir, { json: true, overview: true });
    expect(doc.features[0].verify).toEqual({ verified: 2, failed: 0, missing: 1 });
    expect(doc.attention.filter((a: { kind: string }) => a.kind === "verify-failed")).toEqual([]);
  });

  it("030:FR-002: an unverified result is neither verified nor failed", async () => {
    const doc = await json(new DashboardCommand(), project("  result: passed", "  result: unverified"), { json: true, overview: true });
    expect(doc.features[0].verify).toEqual({ verified: 1, failed: 0, missing: 1 });
  });

  it("030:FR-003: an error in a v2 tasks file is located in tasks.md and fails analyze", async () => {
    const dir = tempProject({
      "903-t": {
        "spec.md": "---\nformat: 2\nstories:\n  - id: US-1\n    status: draft\n---\n\n### US-1 — S\n",
        "tasks.md": "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] [US1] x\n```yaml\nfiles: [\n```\n",
      },
    });
    const r = await runCommand(new AnalyzeCommand(), dir, [], { json: true });
    const report = JSON.parse(r.out) as { formatIssues?: { file: string; kind: string }[] };
    expect(report.formatIssues?.some((i) => i.file === "specs/903-t/tasks.md" && i.kind === "bad-yaml")).toBe(true);
    expect(r.code).toBe(1);
  });
});

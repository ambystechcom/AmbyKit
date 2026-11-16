import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { artifactLines } from "../../src/cli/ui/dashboard/feature-view.js";
import { readFeatures } from "../../src/core/features.js";
import { hasAnsi } from "../ui/helpers.js";

/**
 * One feature with three phases, each with one task:
 *   1 - Verify passed, 2 - Verify failed (with reason), 3 - no Verify line.
 * `variant` swaps in the other cases the criteria name.
 */
function project(variant: "mixed" | "all-passed" | "no-result" | "none"): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-020-vs-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", "001-demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "spec.md"),
    "---\nfeature: 001-demo\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n",
  );
  const verify: Record<string, [string, string, string]> = {
    mixed: ["- **Verify:** `npm test` ✓ passed", "- **Verify:** `npm test` ✗ failed: 2 red", ""],
    "all-passed": ["- **Verify:** `a` ✓ passed", "- **Verify:** `b` ✓ passed", "- **Verify:** `c` ✓ passed"],
    "no-result": ["- **Verify:** `a`", "- **Verify:** `b` ? unverified", "- **Verify:** `c`"],
    none: ["", "", ""],
  };
  const v = verify[variant] ?? ["", "", ""];
  writeFileSync(
    join(dir, "tasks.md"),
    [
      "---",
      "feature: 001-demo",
      "---",
      "",
      "# Tasks",
      "",
      "## Phase 1",
      "",
      "- [x] [T001] [US1] Alpha (src/a.ts)",
      v[0],
      "",
      "## Phase 2",
      "",
      "- [ ] [T002] [US1] Beta (src/b.ts)",
      v[1],
      "",
      "## Phase 3",
      "",
      "- [ ] [T003] [US1] Gamma (src/c.ts)",
      v[2],
      "",
    ].join("\n"),
  );
  return root;
}

type Cmd = { run(ctx: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> };

async function dashboard(cwd: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await (new DashboardCommand() as Cmd).run({ cwd, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

async function overview(root: string) {
  return JSON.parse((await dashboard(root, { json: true, overview: true })).out);
}

describe("dashboard surfaces failed and missing Verify lines (spec 020, US-4)", () => {
  it("SC-003: a failed Verify raises an attention item and the feature is not shown as fully verified", async () => {
    const doc = await overview(project("mixed"));
    expect(doc.attention).toEqual([
      expect.objectContaining({ key: "001:phase-2", kind: "verify-failed", reason: "verify failed: 2 red" }),
    ]);
    expect(doc.features[0].verify).toEqual({ verified: 1, failed: 1, missing: 1 });
  });

  it("FR-010: when every phase is verified the counts say so and there is no verify attention", async () => {
    const doc = await overview(project("all-passed"));
    expect(doc.features[0].verify).toEqual({ verified: 3, failed: 0, missing: 0 });
    expect(doc.attention.filter((a: { kind: string }) => a.kind === "verify-failed")).toEqual([]);
  });

  it("FR-010: a Verify line with no result yet (or '? unverified') counts as verified, failed and missing in none of them", async () => {
    // The decision recorded in the lane-6-2 commit: only a recorded pass is "verified", only a recorded
    // failure is "failed", only an absent Verify line is "missing"; an unrun or unverified check is in none.
    const doc = await overview(project("no-result"));
    expect(doc.features[0].verify).toEqual({ verified: 0, failed: 0, missing: 0 });
    expect(doc.attention.filter((a: { kind: string }) => a.kind === "verify-failed")).toEqual([]);
  });

  it("FR-011: a feature with no Verify lines keeps its row unchanged (no `verify` key)", async () => {
    const doc = await overview(project("none"));
    expect("verify" in doc.features[0]).toBe(false);
    expect(doc.attention.filter((a: { kind: string }) => a.kind === "verify-failed")).toEqual([]);
  });

  it("FR-013: the bare --json story shape is unchanged by Verify lines", async () => {
    const bare = JSON.parse((await dashboard(project("mixed"), { json: true })).out);
    expect(Object.keys(bare[0])).toEqual([
      "id", "displayId", "featureRef", "key", "title", "priority", "status", "dependsOn", "blockedBy",
      "feature", "tasksTotal", "tasksDone", "percent",
    ]);
  });

  it("FR-010, FR-014: the one-shot dashboard names the failed phase and its reason as plain text", async () => {
    const { code, out } = await dashboard(project("mixed"));
    expect(code).toBe(0);
    expect(out).toContain("001:phase-2");
    expect(out).toContain("verify failed: 2 red");
  });

  it("FR-014: --icons=ascii gives a plain layout: no color, only ASCII, and the same facts as text", async () => {
    const { out } = await dashboard(project("mixed"), { icons: "ascii" });
    expect(hasAnsi(out)).toBe(false);
    expect(/^[\x00-\x7f\n]*$/.test(out.replace(/[—]/g, "-"))).toBe(true);
    expect(out).toContain("[v] 001:phase-2");
    expect(out).toContain("verify failed: 2 red");
  });

  it("FR-010: the feature view's tasks.md line carries verify progress and names the failed phase", () => {
    const [feature] = readFeatures(project("mixed")).features;
    const tasksLine = artifactLines(feature!).find((l) => l.file === "tasks.md");
    expect(tasksLine?.detail).toBe("1 / 3  verify 1/2, FAILED phase 2");
    const clean = readFeatures(project("none")).features[0];
    expect(artifactLines(clean!).find((l) => l.file === "tasks.md")?.detail).toBe("1 / 3");
  });
});

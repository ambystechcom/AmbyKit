import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { featureChart } from "../../src/cli/ui/dashboard/feature-chart.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview } from "../../src/core/overview.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "../ui/helpers.js";

/** A one-feature project. `markers: false` is the same project with every marker removed. */
function project(markers: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-020-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", "001-demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "spec.md"),
    "---\nfeature: 001-demo\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n\n### US-2 — Two  (priority: P1)\n\n- **status:** draft\n",
  );
  const m = (s: string) => (markers ? s : "");
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
      `- [ ] [T001] [US1] Alpha (src/a.ts)${m(" ⚠ BLOCKED: waiting on API (v2)")}`,
      `- [ ] [T002] [US1] Beta (src/b.ts)${m(" ↪ DEVIATION: used a map")}`,
      "- [ ] [T003] [US2] Gamma (src/c.ts)",
      `- [x] [T004] [US2] Delta (src/d.ts)${m(" ⚠ BLOCKED: stale")}`,
      `- [ ] [T005] [US2] Epsilon (src/e.ts)${m(" BLOCKED:")}`,
      "",
    ].join("\n"),
  );
  return root;
}

type Cmd = { run(ctx: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> };

async function run(cmd: Cmd, cwd: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await cmd.run({ cwd, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

const dashboard = (root: string, flags: Record<string, string | boolean> = {}) => run(new DashboardCommand() as Cmd, root, flags);
const analyze = (root: string, flags: Record<string, string | boolean> = {}) => run(new AnalyzeCommand() as Cmd, root, flags);

describe("dashboard and analyze surface BLOCKED markers (spec 020, US-2)", () => {
  it("FR-010: one-shot dashboard names the blocked task, its reason and the count, with no model tokens", async () => {
    const { code, out } = await dashboard(project(true));
    expect(code).toBe(0);
    expect(out).toContain("001:T001");
    expect(out).toContain("BLOCKED: waiting on API (v2)");
    expect(out).toContain("BLOCKED (no reason given)");
    expect(out).toContain("2 blocked");
    expect(out).not.toContain("001:T004");
  });

  it("FR-014: --icons=ascii gives a plain layout that carries the same facts as text, no color, no glyphs", async () => {
    const { out } = await dashboard(project(true), { icons: "ascii" });
    expect(hasAnsi(out)).toBe(false);
    expect(/^[\x00-\x7f\n]*$/.test(out.replace(/[—]/g, "-"))).toBe(true);
    expect(out).toContain("[b] 001:T001");
    expect(out).toContain("2 blocked");
  });

  it("FR-014: at a narrow width the feature row still carries the blocked count as plain text", () => {
    const { features, issues } = readFeatures(project(true));
    const overview = computeOverview(features, {}, { upNextCap: 5 }, issues);
    const caps = fakeCapabilities({ color: false, columns: 80 });
    const rows = featureChart(caps, overview.features, "narrow").map(stripAnsi);
    expect(rows.join("\n")).toContain("2 blocked");
    for (const line of rows) expect(visibleWidth(line)).toBeLessThanOrEqual(80);
    // and a feature with no blocked tasks adds nothing at the same width
    const clean = readFeatures(project(false));
    const cleanRows = featureChart(caps, computeOverview(clean.features, {}, { upNextCap: 5 }, clean.issues).features, "narrow");
    expect(stripAnsi(cleanRows.join("\n"))).not.toContain("blocked");
  });

  it("FR-013: --json --overview adds task-blocked items and the blocked count; the bare --json story shape is unchanged", async () => {
    const root = project(true);
    const doc = JSON.parse((await dashboard(root, { json: true, overview: true })).out);
    expect(doc.attention.map((a: { key: string; kind: string }) => `${a.key}:${a.kind}`)).toEqual([
      "001:T001:task-blocked",
      "001:T005:task-blocked",
    ]);
    expect(doc.features[0].blocked).toBe(2);
    const bare = JSON.parse((await dashboard(root, { json: true })).out);
    expect(Object.keys(bare[0])).toEqual([
      "id", "displayId", "featureRef", "key", "title", "priority", "status", "dependsOn", "blockedBy",
      "feature", "tasksTotal", "tasksDone", "percent",
    ]);
  });

  it("FR-009, FR-013: analyze prints blocked tasks, deviations and marker issues; --json carries the new keys; exit stays 0", async () => {
    const root = project(true);
    const text = await analyze(root);
    expect(text.code).toBe(0);
    expect(text.out).toContain("001:T001 — BLOCKED: waiting on API (v2)");
    expect(text.out).toContain("001:T002 — DEVIATION: used a map");
    expect(text.out).toContain("001:T004 is checked but still carries a BLOCKED marker");
    const json = await analyze(root, { json: true });
    expect(json.code).toBe(0);
    const doc = JSON.parse(json.out);
    expect(doc.blockedTasks).toHaveLength(2);
    expect(doc.deviations).toHaveLength(1);
    expect(doc.markerIssues).toHaveLength(2);
  });

  it("FR-011: without markers the dashboard and analyze output carry no blocked-task content and no new keys", async () => {
    const root = project(false);
    const dash = await dashboard(root);
    expect(dash.out).toContain("Nothing blocked.");
    expect(dash.out).not.toMatch(/\d+ blocked/);
    expect(dash.out).not.toContain("BLOCKED");
    const doc = JSON.parse((await dashboard(root, { json: true, overview: true })).out);
    expect(doc.attention).toEqual([]);
    expect("blocked" in doc.features[0]).toBe(false);
    const a = JSON.parse((await analyze(root, { json: true })).out);
    // FR-011: no marker keys appear. The only addition is the missing-Verify warning (`verifyIssues`): this
    // fixture is an unfinished feature whose phase has no Verify line.
    expect(Object.keys(a)).toEqual(["total", "issues", "blocked", "buildable", "orphans", "lanes", "verifyIssues"]);
    expect(a.verifyIssues).toEqual([expect.objectContaining({ kind: "missing", phase: "001:phase-1" })]);
    expect((await analyze(root)).out).not.toContain("BLOCKED");
  });

  it("SC-001: the one-shot dashboard renders in under 1 second", async () => {
    const root = project(true);
    const t0 = performance.now();
    await dashboard(root);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

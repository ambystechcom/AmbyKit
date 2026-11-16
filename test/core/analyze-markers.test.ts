import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { analyzeProject } from "../../src/core/analyze.js";
import { readFeatures } from "../../src/core/features.js";

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

async function run(root: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await new AnalyzeCommand().run({ cwd: root, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

describe("analyze: BLOCKED and DEVIATION markers (spec 020, FR-009)", () => {
  it("FR-009: reports open BLOCKED tasks with their reasons, glyph or not", () => {
    const report = analyzeProject(project(true));
    expect(report.blockedTasks).toEqual([
      { feature: "001", task: "T001", story: "US1", reason: "waiting on API (v2)" },
      { feature: "001", task: "T005", story: "US2", reason: "" },
    ]);
  });

  it("FR-009: reports DEVIATION notes without treating the task as blocked", () => {
    const report = analyzeProject(project(true));
    expect(report.deviations).toEqual([{ feature: "001", task: "T002", note: "used a map" }]);
    expect(report.blockedTasks!.map((b) => b.task)).not.toContain("T002");
  });

  it("FR-009: an empty reason and a checked-but-blocked task are marker issues, not blocks", () => {
    const report = analyzeProject(project(true));
    expect(report.markerIssues!.map((i) => `${i.task}:${i.kind}`).sort()).toEqual([
      "T004:checked-but-blocked",
      "T005:missing-reason",
    ]);
    expect(report.blockedTasks!.map((b) => b.task)).not.toContain("T004");
  });

  it("FR-012: file ownership is recovered with a marker after the path group", () => {
    const tasks = readFeatures(project(true)).features[0]!.tasks!;
    const paths = Object.fromEntries(tasks.map((t) => [t.id, t.paths]));
    expect(paths).toMatchObject({ T001: ["src/a.ts"], T002: ["src/b.ts"], T004: ["src/d.ts"], T005: ["src/e.ts"] });
    expect(tasks.find((t) => t.id === "T001")!.description).not.toContain("BLOCKED");
  });

  it("FR-011: without markers no marker key appears in the report", () => {
    const report = analyzeProject(project(false));
    // The fixture's unfinished phase has no Verify line, so the missing-Verify warning (`verifyIssues`) is the
    // only addition; blockedTasks, deviations and markerIssues stay absent.
    expect(Object.keys(report)).toEqual(["total", "issues", "blocked", "buildable", "orphans", "lanes", "verifyIssues"]);
  });

  it("FR-009: markers are warnings; the exit status does not change", async () => {
    const withMarkers = await run(project(true));
    const without = await run(project(false));
    expect(withMarkers.code).toBe(0);
    expect(without.code).toBe(0);
  });
});

/** A one-feature project whose tasks.md holds exactly the given task lines. */
function projectWith(taskLines: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-020-path-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", "001-demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "spec.md"),
    "---\nfeature: 001-demo\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n",
  );
  writeFileSync(
    join(dir, "tasks.md"),
    ["---", "feature: 001-demo", "---", "", "# Tasks", "", "## Phase 1", "", ...taskLines, ""].join("\n"),
  );
  return root;
}

describe("analyze: a (file/path) group after a marker (spec 020, FR-002, FR-012)", () => {
  it("FR-002: a marker placed before the path group is reported, because the task loses its ownership", () => {
    const report = analyzeProject(projectWith(["- [ ] [T001] [US1] Alpha ⚠ BLOCKED: waiting on the key (src/a.ts)"]));
    expect(report.markerIssues?.map((i) => i.kind)).toEqual(["path-after-marker"]);
    expect(report.markerIssues?.[0]?.task).toBe("T001");
    // The marker still counts: the task is blocked, with the swallowed group in its reason.
    expect(report.blockedTasks?.[0]?.task).toBe("T001");
  });

  it("FR-002: a DEVIATION note before the path group is reported the same way", () => {
    const report = analyzeProject(projectWith(["- [ ] [T001] [US1] Alpha ↪ DEVIATION: used a map (src/a.ts)"]));
    expect(report.markerIssues?.map((i) => i.kind)).toEqual(["path-after-marker"]);
  });

  it("FR-012: markers after the path group are not reported and ownership is kept", () => {
    const root = projectWith(["- [ ] [T001] [US1] Alpha (src/a.ts) ⚠ BLOCKED: waiting on the key (v2)"]);
    expect(analyzeProject(root).markerIssues).toBeUndefined();
    const task = readFeatures(root).features[0]?.tasks?.[0];
    expect(task?.paths).toEqual(["src/a.ts"]);
  });

  it("FR-012: a reason ending in a non-path group is not mistaken for ownership", () => {
    const report = analyzeProject(projectWith(["- [ ] [T001] [US1] Alpha (src/a.ts) ⚠ BLOCKED: needs review (v2)"]));
    expect(report.markerIssues).toBeUndefined();
  });

  it("FR-009: the finding is a warning: the exit status is unchanged", async () => {
    const root = projectWith(["- [ ] [T001] [US1] Alpha ⚠ BLOCKED: waiting (src/a.ts)"]);
    const { code, out } = await run(root);
    expect(code).toBe(0);
    expect(out).toContain("T001");
    const json = await run(root, { json: true });
    expect(json.code).toBe(0);
    expect(JSON.parse(json.out).markerIssues[0].kind).toBe("path-after-marker");
  });
});

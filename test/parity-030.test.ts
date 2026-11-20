import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../src/cli/analyze.js";
import { DashboardCommand } from "../src/cli/dashboard.js";
import { analyzeProject } from "../src/core/analyze.js";
import { planLanes, mergeCheckoffs } from "../src/core/lanes.js";
import { migrateProject } from "../src/core/migrate/run.js";
import { readSpec, readTasks } from "../src/core/spec-format/dispatch.js";
import { setStoryStatus, tickTask } from "../src/core/tasks-edit.js";
import { modelOfSpecs, v1Readers, type Readers } from "./helpers/spec-model.js";
import { runCommand } from "./helpers/run-command.js";
import { ownSpecsCopy } from "./helpers/spec-project.js";

/**
 * 030:SC-001, SC-003, SC-005 — AmbyKit's own specs, migrated in a temporary copy (the real tree is never written), read to
 * the same model and drive `dashboard`, `analyze`, the lane planner, the check-off merge and the MCP tick and status tools
 * to the same results as the 1.x originals.
 */
const dispatcherReaders: Readers = {
  stories: (text, feature) => readSpec(feature, text).stories,
  tasks: (text) => readTasks(text).tasks,
  phases: (text) => readTasks(text).phases,
};

let v1: string;
let v2: string;
let summary: ReturnType<typeof migrateProject>;

beforeAll(() => {
  v1 = ownSpecsCopy();
  v2 = mkdtempSync(join(tmpdir(), "ambykit-030-parity-"));
  cpSync(v1, v2, { recursive: true });
  summary = migrateProject(v2, {});
});

const features = (dir: string): string[] => readdirSync(join(dir, "specs")).filter((f) => /^\d/.test(f)).sort();
const read = (dir: string, f: string, file: string): string | null => {
  try {
    return readFileSync(join(dir, "specs", f, file), "utf8");
  } catch {
    return null;
  }
};
// The temp directory can be printed as given or resolved (macOS: /var is /private/var), so replace both forms.
const normalize = (s: string, dir: string): string => s.split(realpathSync(dir)).join("<root>").split(dir).join("<root>").replace(/\\/g, "/");

describe("own specs migrate cleanly (030, SC-001, SC-002)", () => {
  it("030:SC-001: every spec and tasks file converts, none is skipped", () => {
    expect(summary.counts.skipped, summary.records.filter((r) => r.status === "skipped").map((r) => `${r.feature}/${r.file}: ${r.reason}`).join("\n")).toBe(0);
    expect(summary.counts.converted).toBeGreaterThanOrEqual(2 * features(v1).length - 4);
    expect(summary.config.written).toBe(true);
  });

  it("030:SC-002: a second migrate changes nothing", () => {
    const again = migrateProject(v2, {});
    expect(again.counts.converted).toBe(0);
    expect(again.counts.skipped).toBe(0);
    expect(again.counts.unchanged).toBe(summary.counts.converted + summary.counts.unchanged);
  });

  it("030:SC-001: the migrated files read with no format error", () => {
    const report = analyzeProject(v2);
    expect((report.formatIssues ?? []).filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("the migrated copy reads to the 1.x model (030, SC-001, FR-018)", () => {
  it("030:SC-001: stories, tasks (with ownership, markers) and phases (with Verify) are equal for every feature", () => {
    const before = modelOfSpecs(join(v1, "specs"), v1Readers, undefined, true);
    const after = modelOfSpecs(join(v2, "specs"), dispatcherReaders, undefined, false);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const f of Object.keys(before)) {
      expect(after[f]?.stories, `${f} stories`).toEqual(before[f]?.stories);
      expect(after[f]?.phases, `${f} phases`).toEqual(before[f]?.phases);
      expect(after[f]?.tasks, `${f} tasks`).toEqual(before[f]?.tasks);
    }
  });
});

describe("commands agree on the 1.x original and the migrated copy (030, SC-003)", () => {
  const withoutHeader = (out: string): string => out.split("\n").slice(1).join("\n");

  it("030:SC-003: analyze --json is equal apart from the format-issue warnings the migrated files may carry", async () => {
    const a = JSON.parse((await runCommand(new AnalyzeCommand(), v1, [], { json: true })).out) as Record<string, unknown>;
    const b = JSON.parse((await runCommand(new AnalyzeCommand(), v2, [], { json: true })).out) as Record<string, unknown>;
    const warnings = (b["formatIssues"] ?? []) as { severity: string }[];
    expect(warnings.every((w) => w.severity === "warning")).toBe(true);
    delete b["formatIssues"];
    expect(b).toEqual(a);
  });

  it("030:SC-003: analyze text exits the same and lists the same findings", async () => {
    const a = await runCommand(new AnalyzeCommand(), v1, [], {});
    const b = await runCommand(new AnalyzeCommand(), v2, [], {});
    expect(b.code).toBe(a.code);
    // Known and documented: the migrated files list format-issue warnings (F-4: nine tasks whose prose ends in a
    // path-like parenthetical before the real ownership group). Nothing else may differ.
    const keep = (s: string): string =>
      s
        .split("\n")
        .filter((l) => !/Spec format issues:|\[trailing-group-disagrees\]/.test(l))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
    expect(keep(b.out)).toBe(keep(a.out));
    expect(keep(b.err)).toBe(keep(a.err));
  });

  it("030:SC-003: dashboard (one-shot, --json, --json --overview) is the same", async () => {
    for (const flags of [{}, { json: true }, { json: true, overview: true }] as Record<string, string | boolean>[]) {
      const a = await runCommand(new DashboardCommand(), v1, [], flags);
      const b = await runCommand(new DashboardCommand(), v2, [], flags);
      expect(b.code).toBe(a.code);
      // Known and documented: a 1.x task description ends with its ownership group, a v2 one never does, so "UP NEXT"
      // lines lose their trailing `(file/path)`. Compare the text without it.
      const noGroup = (s: string): string => s.replace(/(?: \([^()\n]*\))+$/gm, "");
      const noGroupJson = (s: string): string => s.replace(/(?: \([^()"\n]*\))+"/g, '"');
      const clean = (s: string, dir: string): string => normalize(flags["json"] ? noGroupJson(s) : noGroup(withoutHeader(s)), dir);
      expect(clean(b.out, v2), JSON.stringify(flags)).toBe(clean(a.out, v1));
    }
  });

  it("030:SC-003: the lane plan is the same for every phase of every feature", () => {
    let planned = 0;
    for (const f of features(v1)) {
      const t1 = read(v1, f, "tasks.md");
      const t2 = read(v2, f, "tasks.md");
      if (t1 === null || t2 === null) continue;
      const a = readTasks(t1).tasks;
      const b = readTasks(t2).tasks;
      for (const phase of new Set(a.map((t) => t.phase))) {
        expect(planLanes(f, b, { phase, lanes: 3 }), `${f} phase ${phase}`).toEqual(planLanes(f, a, { phase, lanes: 3 }));
        planned += 1;
      }
    }
    expect(planned).toBeGreaterThan(50);
  });

  it("030:SC-003: the check-off merge unions the ticks of two lanes the same way", () => {
    let merged = 0;
    for (const f of features(v1)) {
      const t1 = read(v1, f, "tasks.md");
      const t2 = read(v2, f, "tasks.md");
      if (t1 === null || t2 === null) continue;
      const open = (t: string): string[] => readTasks(t).tasks.filter((x) => !x.done).map((x) => x.id);
      const ids = open(t1);
      if (ids.length < 2) continue;
      const tick = (t: string, id: string): string => t.replace(new RegExp(`(\\[ \\])(\\s*\\[${id}\\])`), "[x]$2");
      const run = (t: string): string[] => {
        const out = mergeCheckoffs(t, tick(t, ids[0] as string), tick(t, ids[1] as string));
        expect(out, `${f}`).not.toBeNull();
        return readTasks(out ?? "").tasks.filter((x) => x.done).map((x) => x.id);
      };
      expect(run(t2), f).toEqual(run(t1));
      merged += 1;
    }
    expect(merged).toBeGreaterThan(0);
  });

  it("030:SC-003: the MCP tick and status tools give the same results and the same checked tasks", () => {
    const a = mkdtempSync(join(tmpdir(), "ambykit-030-tick-a-"));
    const b = mkdtempSync(join(tmpdir(), "ambykit-030-tick-b-"));
    cpSync(v1, a, { recursive: true });
    cpSync(v2, b, { recursive: true });
    const dir = features(a).find((f) => {
      const t = read(a, f, "tasks.md");
      return t !== null && readTasks(t).tasks.some((x) => !x.done);
    }) as string;
    const first = readTasks(read(a, dir, "tasks.md") ?? "").tasks.find((x) => !x.done) as { id: string };
    expect(tickTask(b, dir, first.id)).toEqual(tickTask(a, dir, first.id));
    const done = (root: string): string[] => readTasks(read(root, dir, "tasks.md") ?? "").tasks.filter((x) => x.done).map((x) => x.id);
    expect(done(b)).toEqual(done(a));
    const story = readSpec(dir, read(a, dir, "spec.md") ?? "").stories[0] as { displayId: string };
    expect(setStoryStatus(b, dir, story.displayId, "in-progress")).toEqual(setStoryStatus(a, dir, story.displayId, "in-progress"));
    expect(readSpec(dir, read(b, dir, "spec.md") ?? "").stories.map((s) => s.status)).toEqual(readSpec(dir, read(a, dir, "spec.md") ?? "").stories.map((s) => s.status));
  });
});

describe("a mixed project reads together (030, SC-005)", () => {
  it("030:SC-005: half the features migrated, half left on 1.x: dashboard and analyze agree with the original", async () => {
    const mixed = mkdtempSync(join(tmpdir(), "ambykit-030-mixed-"));
    cpSync(v1, mixed, { recursive: true });
    const all = features(v1);
    for (const f of all.slice(0, Math.ceil(all.length / 2))) migrateProject(mixed, { feature: f });
    const a = await runCommand(new DashboardCommand(), v1, [], { json: true, overview: true });
    const b = await runCommand(new DashboardCommand(), mixed, [], { json: true, overview: true });
    expect(normalize(b.out, mixed)).toBe(normalize(a.out, v1));
    const report = analyzeProject(mixed);
    const reference = analyzeProject(v1);
    expect(report.total).toBe(reference.total);
    expect(report.buildable).toEqual(reference.buildable);
    expect(report.issues).toEqual(reference.issues);
  });
});

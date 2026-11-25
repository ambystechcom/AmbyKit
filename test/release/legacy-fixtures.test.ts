import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/core/analyze.js";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { modelOf, v1Readers, type Readers } from "../helpers/spec-model.js";

/**
 * 034:FR-006 — 2.0 keeps fixtures of the 1.x format, so reading 1.x stays tested after AmbyKit's own specs are migrated (US-3):
 * a 1.x spec and task list, a v2 twin of each, and a mixed repository holding both. The 1.x files read through the shipped 1.x
 * readers and through the per-file dispatcher to the same model as their v2 twins.
 */
const fixtures = resolve(__dirname, "..", "fixtures");
const twins = join(fixtures, "spec-format-twins");
const twin = (kind: "v1" | "v2", file: string) => readFileSync(join(twins, kind, "specs", "001-twin", file), "utf8");

const dispatcher: Readers = {
  stories: (text, feature) => readSpec(feature, text).stories,
  tasks: (text) => readTasks(text).tasks,
  phases: (text) => readTasks(text).phases,
};

describe("1.x fixtures still read in 2.0 (034, US-3)", () => {
  it("034:FR-006: the 1.x fixtures exist and are 1.x; their twins are v2", () => {
    for (const f of ["spec.md", "tasks.md"]) {
      expect(twin("v1", f)).not.toMatch(/^format: 2$/m);
      expect(twin("v2", f)).toMatch(/^format: 2$/m);
    }
    expect(readSpec("001-twin", twin("v1", "spec.md")).format).toBe(1);
    expect(readTasks(twin("v1", "tasks.md")).format).toBe(1);
    for (const f of ["spec.v1.md", "tasks.v1.md", "tasks.dup-verify.v1.md"]) expect(existsSync(join(fixtures, "spec-format", "edge-rich", f)), f).toBe(true);
    expect(existsSync(join(fixtures, "spec-model-v1.json"))).toBe(true);
  });

  it("034:FR-006: a 1.x spec and task list read to the same model as their v2 twins", () => {
    const v1 = modelOf("001-twin", twin("v1", "spec.md"), twin("v1", "tasks.md"), v1Readers);
    const v2 = modelOf("001-twin", twin("v2", "spec.md"), twin("v2", "tasks.md"), dispatcher, false);
    expect(v1.stories.length).toBeGreaterThan(0);
    expect(v1.tasks.length).toBeGreaterThan(0);
    expect(v2).toEqual(v1);
    // The dispatcher reads the 1.x files exactly as the 1.x readers do.
    expect(modelOf("001-twin", twin("v1", "spec.md"), twin("v1", "tasks.md"), dispatcher)).toEqual(v1);
  });

  it("034:FR-006: a repository holding a 1.x and a v2 feature reads both, and analyze treats them alike", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-034-mixed-"));
    mkdirSync(join(dir, ".amby"), { recursive: true });
    writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
    cpSync(join(twins, "v1", "specs", "001-twin"), join(dir, "specs", "001-twin"), { recursive: true });
    mkdirSync(join(dir, "specs", "002-twin"), { recursive: true });
    for (const f of ["spec.md", "tasks.md"]) writeFileSync(join(dir, "specs", "002-twin", f), twin("v2", f).replace(/001-twin/g, "002-twin"));

    const read = (feature: string, f: string) => readFileSync(join(dir, "specs", feature, f), "utf8");
    const one = modelOf("001-twin", read("001-twin", "spec.md"), read("001-twin", "tasks.md"), dispatcher);
    const two = modelOf("002-twin", read("002-twin", "spec.md"), read("002-twin", "tasks.md"), dispatcher, false);
    expect(readSpec("001-twin", read("001-twin", "spec.md")).format).toBe(1);
    expect(readSpec("002-twin", read("002-twin", "spec.md")).format).toBe(2);
    expect(JSON.parse(JSON.stringify(two).replace(/002-twin/g, "001-twin"))).toEqual(one);

    const report = analyzeProject(dir) as { formatIssues?: unknown[] };
    expect(report.formatIssues ?? []).toEqual([]);
  });
});

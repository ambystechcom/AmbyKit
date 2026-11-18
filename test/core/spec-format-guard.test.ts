import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 030:FR-021 — one per-file dispatcher. No module outside `src/core/spec-format/` and the v1 parser files themselves
 * (`dashboard.ts` defines parseStories/parseTasks, `markers.ts` defines parsePhases) may import the v1 parsers directly,
 * so a new reader (028, 029, 031, 032 …) cannot silently skip the v2 reader and history stays readable in both formats.
 */
const src = join(import.meta.dirname, "..", "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const V1_FILES = new Set(["core/dashboard.ts", "core/markers.ts"]);
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']*(?:dashboard|markers)\.js)["']/g;
const V1_NAMES = /\b(parseStories|parseTasks|parsePhases)\b/;

describe("spec reader guard (030, FR-021)", () => {
  it("030:FR-021: nothing outside the dispatcher imports parseStories, parseTasks or parsePhases", () => {
    const offenders: string[] = [];
    for (const file of walk(src)) {
      const rel = relative(src, file).replace(/\\/g, "/");
      if (rel.startsWith("core/spec-format/") || V1_FILES.has(rel)) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(IMPORT_RE)) {
        if (V1_NAMES.test(m[1] ?? "")) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("030:FR-021: the guard really sees an offending import", () => {
    const sample = 'import { applyTasks, parseTasks } from "./dashboard.js";';
    const found = [...sample.matchAll(IMPORT_RE)].some((m) => V1_NAMES.test(m[1] ?? ""));
    expect(found).toBe(true);
  });
});

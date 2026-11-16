import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { loadConfig } from "./config.js";
import { featureRefOf } from "./dashboard.js";
import { compareFeatureDirs } from "./features.js";
import { readDesign } from "./trace-design.js";
import { parseDeliberate, parseRequirements } from "./trace-requirements.js";
import { extractTests } from "./trace-tests.js";
import type { DesignInput, TestEntry, TraceFeature } from "./trace-types.js";

/** Never descended into by the test walk (plan: discovery). */
export const DEFAULT_IGNORE = ["node_modules", "dist", "coverage", ".git", ".worktrees", ".amby", "specs"];
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
/** Files larger than this are skipped (budget, SC-001). */
const MAX_BYTES = 1_000_000;

/** Walk the roots for `*.test.*` / `*.spec.*` files; paths are returned relative to the project root. */
export function findTestFiles(projectRoot: string, roots: string[] = ["."], ignore: string[] = DEFAULT_IGNORE): string[] {
  const out: string[] = [];
  const skip = new Set(ignore);
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skip.has(e.name)) walk(join(dir, e.name));
      } else if (e.isFile() && TEST_FILE.test(e.name)) out.push(join(dir, e.name));
    }
  };
  for (const r of roots) {
    const abs = join(projectRoot, r);
    if (existsSync(abs)) walk(abs);
  }
  return out.map((p) => relative(projectRoot, p).split("\\").join("/")).sort();
}

/** Read every test file's titles. Unreadable or oversized files are skipped, never fatal. */
export function readTests(projectRoot: string, files: string[]): TestEntry[] {
  const out: TestEntry[] = [];
  for (const file of files) {
    try {
      const abs = join(projectRoot, file);
      if (statSync(abs).size > MAX_BYTES) continue;
      out.push(...extractTests(file, readFileSync(abs, "utf8")));
    } catch {
      /* skip */
    }
  }
  return out;
}

export interface TraceSources {
  features: TraceFeature[];
  designs: Map<string, DesignInput>;
  tests: TestEntry[];
}

/** The only disk edge of `trace`: specs, each `tests.md`, and the configured test roots. */
export function readTraceSources(projectRoot: string): TraceSources {
  const trace = loadConfig(projectRoot).trace;
  const specsRoot = join(projectRoot, "specs");
  const features: TraceFeature[] = [];
  const designs = new Map<string, DesignInput>();
  const dirs = existsSync(specsRoot)
    ? readdirSync(specsRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(specsRoot, e.name, "spec.md")))
        .map((e) => e.name)
        .sort(compareFeatureDirs)
    : [];
  for (const dir of dirs) {
    let spec = "";
    try {
      spec = readFileSync(join(specsRoot, dir, "spec.md"), "utf8");
    } catch {
      continue;
    }
    const deliberate = parseDeliberate(spec);
    const testsFile = join(specsRoot, dir, "tests.md");
    if (existsSync(testsFile)) {
      try {
        const text = readFileSync(testsFile, "utf8");
        // tests.md wins over a note in the spec (FR-010).
        for (const [id, reason] of parseDeliberate(text)) deliberate.set(id, reason);
        designs.set(dir, readDesign(text));
      } catch {
        /* unreadable tests.md: requirement-only */
      }
    }
    features.push({ dir, ref: featureRefOf(dir), requirements: parseRequirements(spec), deliberate });
  }
  const files = findTestFiles(projectRoot, trace?.roots, [...DEFAULT_IGNORE, ...(trace?.ignore ?? [])]);
  return { features, designs, tests: readTests(projectRoot, files) };
}

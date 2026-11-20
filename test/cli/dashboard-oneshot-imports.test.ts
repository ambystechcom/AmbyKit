import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Feature 032, FR-011: one-shot and `--json` never load the heavy views. `dashboard.ts` may only reach the graph view,
 * the Fleet view and the metrics reader through a dynamic `import()` (interactive path, or `--metrics`), never through
 * a static import chain. Type-only imports are erased, so they do not load anything.
 */
const src = join(import.meta.dirname, "..", "..", "src");

/** Files a module loads at startup: static `import`/`export … from` of relative modules, excluding `import type`. */
function staticImports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["'](\.[^"']+)["']/gms;
  for (const m of text.matchAll(re)) {
    if (m[2]) continue; // `import type` / `export type`: erased
    const target = resolve(dirname(file), m[4]!.replace(/\.js$/, ".ts"));
    if (existsSync(target)) out.push(target);
  }
  const bare = /^\s*import\s*["'](\.[^"']+)["']/gm;
  for (const m of text.matchAll(bare)) {
    const target = resolve(dirname(file), m[1]!.replace(/\.js$/, ".ts"));
    if (existsSync(target)) out.push(target);
  }
  return out;
}

function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    queue.push(...staticImports(f));
  }
  return seen;
}

describe("one-shot and --json never load the heavy views (feature 032, US-5)", () => {
  const loaded = [...reachable(join(src, "cli", "dashboard.ts"))].map((f) => relative(src, f).replaceAll("\\", "/"));

  it("032:FR-011: the metrics reader is not on dashboard.ts's static import chain", () => {
    expect(loaded.filter((f) => f.startsWith("core/metrics/") && f !== "core/metrics/types.ts")).toEqual([]);
    expect(loaded).not.toContain("core/metrics/index.ts");
  });

  it("032:FR-011: the graph view and the Fleet view are not on the static import chain either", () => {
    expect(loaded).not.toContain("cli/ui/dashboard/graph-view.ts");
    expect(loaded).not.toContain("cli/ui/dashboard/fleet-view.ts");
  });

  it("032:FR-011: dashboard.ts reaches them by dynamic import", () => {
    const text = readFileSync(join(src, "cli", "dashboard.ts"), "utf8");
    expect(text).toMatch(/import\(["']\.\.\/core\/metrics\/index\.js["']\)/);
    expect(text).toMatch(/import\(["']\.\/ui\/dashboard\/graph-view\.js["']\)/);
    expect(text).toMatch(/import\(["']\.\/ui\/dashboard\/fleet-view\.js["']\)/);
  });

  it("032:FR-011: the analysis sees a real chain (it reaches the overview core), so the checks above are not vacuous", () => {
    expect(loaded).toContain("core/overview.ts");
    expect(loaded.length).toBeGreaterThan(20);
  });
});

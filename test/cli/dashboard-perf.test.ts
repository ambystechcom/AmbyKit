import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { readFeatures } from "../../src/core/features.js";
import { perfFixture } from "../helpers/dashboard-perf-fixture.js";
import { scaledBudget } from "../helpers/machine-load.js";

async function timed(flags: Record<string, string | boolean>): Promise<number> {
  const root = perfFixture();
  const orig = console.log;
  console.log = () => {};
  const t0 = performance.now();
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    console.log = orig;
  }
  return performance.now() - t0;
}

describe("dashboard performance (SC-003)", () => {
  it("renders 30 features / ~1,000 tasks in under 1 s", async () => {
    const root = perfFixture();
    const tasks = readFeatures(root).features.reduce((n, f) => n + (f.tasks?.length ?? 0), 0);
    expect(tasks).toBeGreaterThanOrEqual(1000);
    const orig = console.log;
    console.log = () => {};
    const t0 = performance.now();
    try {
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: {} });
    } finally {
      console.log = orig;
    }
    expect(performance.now() - t0).toBeLessThan(scaledBudget(1000));
  });

  it("keeps the 1 s budget with the shared graph behind the attention list, one-shot and --json --overview (feature 023, FR-015)", async () => {
    expect(await timed({})).toBeLessThan(scaledBudget(1000));
    expect(await timed({ json: true, overview: true })).toBeLessThan(scaledBudget(1000));
  });
});

describe("the graph view is loaded only by the interactive dashboard (feature 023, FR-015)", () => {
  const src = join(import.meta.dirname, "..", "..", "src");
  const files = (dir = src): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
    );
  const rel = (f: string): string => relative(src, f).replace(/\\/g, "/");
  const text = (f: string): string => readFileSync(f, "utf8");

  it("graph-view is imported statically by no module: only types, and one dynamic import in the command", () => {
    const staticValueImports = files()
      .filter((f) => /^import (?!type)[^;]*from "[^"]*graph-view\.js"/m.test(text(f)))
      .map(rel);
    expect(staticValueImports).toEqual([]);
    const dynamic = files()
      .filter((f) => /import\("[^"]*graph-view\.js"\)/.test(text(f)))
      .map(rel);
    expect(dynamic).toEqual(["cli/dashboard.ts"]);
  });

  it("graph-paths is never imported by the one-shot dashboard path", () => {
    const importers = files()
      .filter((f) => /from "[^"]*graph-paths\.js"/.test(text(f)))
      .map(rel)
      .sort();
    // analyze (its own command), the graph view (interactive only), the MCP read queries (feature 025,
    // reached only from the `mcp` server and `directive`), the run scheduler (feature 028, reached only from
    // `ambykit run`) and the public barrel; never the dashboard.
    expect(importers).toEqual(["cli/ui/dashboard/graph-view.ts", "core/analyze.ts", "core/index.ts", "core/query.ts", "core/run-schedule.ts"]);
  });
});

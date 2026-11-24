import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { buildMatrix } from "../../src/core/trace.js";
import { readTraceSources } from "../../src/core/trace-io.js";
import { scaledBudget } from "../helpers/machine-load.js";

function bigProject(): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-trace-perf-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "1.0.0", tools: [] }));
  for (let i = 1; i <= 30; i++) {
    const n = String(i).padStart(3, "0");
    const dir = join(root, "specs", `${n}-feature-${i}`);
    mkdirSync(dir, { recursive: true });
    const frs = Array.from({ length: 12 }, (_, k) => `- FR-${String(k + 1).padStart(3, "0")}  THE SYSTEM SHALL thing ${k}.`).join("\n");
    writeFileSync(join(dir, "spec.md"), `---\nfeature: f\n---\n# Spec\n\n${frs}\n`);
    writeFileSync(join(dir, "tasks.md"), "## Phase 1\n\n- [x] [T001] [US1] a (src/a.ts)\n");
  }
  mkdirSync(join(root, "test"), { recursive: true });
  for (let i = 0; i < 200; i++) {
    const tests = Array.from({ length: 10 }, (_, k) => `it("${String((i % 30) + 1).padStart(3, "0")}:FR-${String((k % 12) + 1).padStart(3, "0")}: case ${i}.${k}", () => {});`).join("\n");
    writeFileSync(join(root, "test", `f${i}.test.ts`), tests);
  }
  return root;
}

describe("trace performance (SC-001)", () => {
  const root = bigProject();

  it("024:FR-001: 200 test files and 30 features trace in under one second", () => {
    const t0 = performance.now();
    const src = readTraceSources(root);
    const report = buildMatrix({ features: src.features, tests: src.tests });
    expect(performance.now() - t0).toBeLessThan(scaledBudget(1000));
    expect(src.tests).toHaveLength(2000);
    expect(report.features).toHaveLength(30);
  });

  it("024:FR-012: the dashboard with coverage stays inside the one-second budget", async () => {
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
});

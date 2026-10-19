import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { readFeatures } from "../../src/core/features.js";
import { perfFixture } from "../helpers/dashboard-perf-fixture.js";

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
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

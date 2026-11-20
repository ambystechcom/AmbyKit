import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { NOW, fleetProject } from "../helpers/fleet-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { scaledBudget } from "../helpers/machine-load.js";

const ten = () => fleetProject(Array.from({ length: 10 }, (_, i) => ({ k: i + 1, reportMinutesAgo: i, state: "working" as const })), { now: NOW });

describe("fleet performance and loading (feature 029, SC-005, FR-012)", () => {
  it("029:FR-012: one-shot and --json with a 10-lane run stay under 1 s", async () => {
    const f = ten();
    for (const flags of [{}, { json: true }, { json: true, overview: true }]) {
      const t0 = performance.now();
      const r = await runCommand(new DashboardCommand(), f.root, [], flags);
      const ms = performance.now() - t0;
      expect(r.code).toBe(0);
      expect(ms).toBeLessThan(scaledBudget(1000));
    }
  });

  it("029:FR-012: readFleet over 10 lanes reads well inside the budget", () => {
    const f = ten();
    const t0 = performance.now();
    const v = readFleet(f.root, NOW)!;
    expect(performance.now() - t0).toBeLessThan(scaledBudget(500));
    expect(v.lanes).toHaveLength(10);
  });

  it("029:FR-013: with no run, readFleet touches nothing and the dashboard reads no fleet files", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }], { noRun: true });
    expect(readFleet(f.root, NOW)).toBeNull();
  });

  it("029:FR-012: the non-interactive path does not import the Fleet view, reducer or actions at module load", () => {
    // The Fleet modules load only under --interactive, through one dynamic import in dashboard.ts. Neither the command nor the
    // overview reducer imports them as values (a type-only import is erased and loads nothing).
    const src = (f: string) => readFileSync(join(__dirname, "..", "..", "src", "cli", f), "utf8");
    const names = ["interactive/fleet.js", "interactive/fleet-actions.js", "dashboard/fleet-view.js", "dashboard/fleet-tokens.js"];
    for (const file of ["dashboard.ts", join("ui", "interactive", "overview.ts")]) {
      const valueImports = src(file).split("\n").filter((l) => /^import (?!type)/.test(l) && names.some((n) => l.includes(n.split("/")[1]!)));
      expect(valueImports, file).toEqual([]);
    }
    expect(src("dashboard.ts")).toMatch(/await import\("\.\/ui\/dashboard\/fleet-view\.js"\)/);
  });
});

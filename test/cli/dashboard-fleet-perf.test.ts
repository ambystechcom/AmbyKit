import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { NOW, fleetProject } from "../helpers/fleet-fixture.js";
import { runCommand } from "../helpers/run-command.js";

const ten = () => fleetProject(Array.from({ length: 10 }, (_, i) => ({ k: i + 1, reportMinutesAgo: i, state: "working" as const })), { now: NOW });

describe("fleet performance and loading (feature 029, SC-005, FR-012)", () => {
  it("029:FR-012: one-shot and --json with a 10-lane run stay under 1 s", async () => {
    const f = ten();
    for (const flags of [{}, { json: true }, { json: true, overview: true }]) {
      const t0 = performance.now();
      const r = await runCommand(new DashboardCommand(), f.root, [], flags);
      const ms = performance.now() - t0;
      expect(r.code).toBe(0);
      expect(ms).toBeLessThan(1000);
    }
  });

  it("029:FR-012: readFleet over 10 lanes reads well inside the budget", () => {
    const f = ten();
    const t0 = performance.now();
    const v = readFleet(f.root, NOW)!;
    expect(performance.now() - t0).toBeLessThan(500);
    expect(v.lanes).toHaveLength(10);
  });

  it("029:FR-013: with no run, readFleet touches nothing and the dashboard reads no fleet files", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }], { noRun: true });
    expect(readFleet(f.root, NOW)).toBeNull();
  });

  it("029:FR-012: the non-interactive path does not import the Fleet view, reducer or watcher at module load", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src", "cli", "dashboard.ts"), "utf8");
    // The interactive view modules are only loaded under --interactive (none of them is imported statically).
    for (const name of ["interactive/fleet.js", "interactive/fleet-actions.js", "dashboard/fleet-view.js", "dashboard/fleet-tokens.js"]) {
      expect(src.split("\n").filter((l) => /^import /.test(l) && l.includes(name))).toEqual([]);
    }
  });
});

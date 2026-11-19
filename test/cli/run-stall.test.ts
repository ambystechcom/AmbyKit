import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, script } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

function configure(root: string, patch: Record<string, unknown>): void {
  const file = join(root, ".amby", "config.json");
  const cfg = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...cfg, ...patch }) + "\n");
}

describe.skipIf(!HAS_GIT)("stall limit is the fleet's own (feature 028)", () => {
  it("028:FR-008: the dashboard's idle limit does not decide when a lane is stalled", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { dashboard: { activeMinutes: 1, idleMinutes: 2 } });
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(10); // far past the dashboard's idle limit, still inside fleet.stallMinutes (15)
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
    h.advance(6);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
  });

  it("028:FR-008: fleet.stallMinutes sets the limit", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { fleet: { stallMinutes: 5 } });
    const h = harness(p);
    expect(h.s.settings.stallMinutes).toBe(5);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(4);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
    h.advance(2);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
  });

  it("028:FR-009: fleet.restartLimit is the same object the supervisor reads", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { fleet: { restartLimit: 1 } });
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(16);
    await h.step();
    h.advance(16);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
  });

  it("028:FR-008: a restart spends one task event of the budget (room for rework)", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(16);
    await h.step();
    const { readBudget } = await import("../../src/cli/run-files.js");
    expect(readBudget(p.root, h.run).tasksUsed).toBe(2); // both hung lanes restarted
  });
});

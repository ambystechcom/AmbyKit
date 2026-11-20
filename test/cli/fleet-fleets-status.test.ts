import { describe, expect, it } from "vitest";
import { FleetCommand } from "../../src/cli/fleet.js";
import { createFleet, createRun, updateRun } from "../../src/core/fleet/index.js";
import type { FleetFeature } from "../../src/core/fleet-plan/types.js";
import { runCommand } from "../helpers/run-command.js";
import { tempProject } from "../helpers/spec-project.js";

const feat = (feature: string, state: FleetFeature["state"], over: Partial<FleetFeature> = {}): FleetFeature => ({
  feature,
  state,
  waitsFor: [],
  ownership: { files: [], unknown: [] },
  fingerprint: "f",
  ...over,
});

function pausedFleet(): string {
  const root = tempProject({});
  createFleet(root, {
    features: [
      feat("031-a", "paused", { run: "031-a.1", cause: "lane-1-1 paused (stalled again after 2 restarts; a person must decide)" }),
      feat("032-b", "waiting", { waitsFor: [{ feature: "031-a", why: "depends-on" }], heldBy: "031-a" }),
      feat("033-c", "running", { run: "033-c.1" }),
    ],
    caps: { total: 3, perType: 2 },
    budgets: { wallClockMinutes: 120, maxTasks: 20 },
    unattended: false,
  });
  createRun(root, "031-a", { fleet: "fleet-1", lanes: [{ lane: "031-a.lane-1-1", assistant: "claude", tasks: ["T001"] }] });
  createRun(root, "033-c", { fleet: "fleet-1", lanes: [{ lane: "033-c.lane-1-1", assistant: "codex", tasks: ["T001"] }] });
  updateRun(root, "031-a.1", { escalations: [{ kind: "restart-limit", lane: "lane-1-1" }] });
  return root;
}

describe("the fleet status shows why a feature is paused and what it affects (feature 031, US-4)", () => {
  it("031:FR-009: the text names the cause and the features the pause holds", async () => {
    const r = await runCommand(new FleetCommand(), pausedFleet(), ["fleets"], {});
    expect(r.code).toBe(0);
    expect(r.out).toContain("031-a  paused  run 031-a.1");
    expect(r.out).toContain("paused: lane-1-1 paused (stalled again after 2 restarts; a person must decide)");
    expect(r.out).toContain("holds: 032-b");
    expect(r.out).toContain("held while 031-a is paused");
  });

  it("031:FR-009: the JSON carries the cause, the affected features and who holds whom", async () => {
    const r = await runCommand(new FleetCommand(), pausedFleet(), ["fleets"], { json: true });
    const doc = JSON.parse(r.out) as { fleets: { features: { feature: string; cause?: string; affected?: string[]; heldBy?: string }[] }[] };
    const [a, b] = doc.fleets[0]!.features;
    expect(a).toMatchObject({ feature: "031-a", cause: expect.stringContaining("stalled again"), affected: ["031-a", "032-b"] });
    expect(b).toMatchObject({ feature: "032-b", heldBy: "031-a" });
  });
});

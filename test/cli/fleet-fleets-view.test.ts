import { describe, expect, it } from "vitest";
import { FleetCommand } from "../../src/cli/fleet.js";
import { createFleet, createRun } from "../../src/core/fleet/index.js";
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

function twoFleets(): string {
  const root = tempProject({});
  const init = { caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 120, maxTasks: 20, maxTokens: 5000 }, unattended: false };
  createFleet(root, { ...init, features: [feat("031-a", "running", { run: "031-a.1" }), feat("032-b", "waiting", { waitsFor: [{ feature: "031-a", why: "shared-files", files: ["src/x.ts"] }], ownership: { files: [], unknown: ["T002"] } })] });
  createFleet(root, { ...init, features: [feat("040-z", "done")] });
  createRun(root, "031-a", { fleet: "fleet-1", lanes: [{ lane: "031-a.lane-1-1", assistant: "claude", tasks: ["T001"] }, { lane: "031-a.lane-1-2", assistant: "codex", tasks: ["T002"] }] });
  return root;
}

describe("one view of every feature's lanes and states (feature 031, US-6)", () => {
  it("031:FR-014: ambykit fleet groups lanes by feature, for every fleet", async () => {
    const r = await runCommand(new FleetCommand(), twoFleets(), ["fleets"], {});
    expect(r.code).toBe(0);
    expect(r.out).toContain("fleet-1  active  2 features  caps 3 total / 2 per type  budgets 120 min, 20 task events, 5000 tokens");
    expect(r.out).toContain("  031-a  running  run 031-a.1");
    expect(r.out).toMatch(/lane-1-1 \S+ \(claude\)/);
    expect(r.out).toMatch(/lane-1-2 \S+ \(codex\)/);
    expect(r.out).toContain("waits for 031-a (shared-files: src/x.ts)");
    expect(r.out).toContain("unknown ownership: T002");
    expect(r.out).toContain("fleet-2");
  });

  it("031:FR-014: a fleet id shows only that fleet", async () => {
    const r = await runCommand(new FleetCommand(), twoFleets(), ["fleets", "fleet-2"], {});
    expect(r.out).toContain("040-z  done");
    expect(r.out).not.toContain("031-a");
  });

  it("031:FR-014: --json is the read model: fleets, features, runs, lanes", async () => {
    const r = await runCommand(new FleetCommand(), twoFleets(), ["fleets"], { json: true });
    const doc = JSON.parse(r.out) as { fleets: { fleet: string; features: { feature: string; lanes: { lane: string; assistant: string }[] }[] }[] };
    expect(doc.fleets.map((f) => f.fleet)).toEqual(["fleet-1", "fleet-2"]);
    expect(doc.fleets[0]!.features[0]!.lanes.map((l) => [l.lane, l.assistant])).toEqual([["lane-1-1", "claude"], ["lane-1-2", "codex"]]);
  });

  it("031:FR-014: an unknown fleet id is an error; no fleets says how to start one", async () => {
    const root = twoFleets();
    expect((await runCommand(new FleetCommand(), root, ["fleets", "fleet-9"], {})).code).toBe(1);
    const none = await runCommand(new FleetCommand(), tempProject({}), ["fleets"], {});
    expect(none.code).toBe(0);
    expect(none.out).toContain("No fleets. Start one with: ambykit run <feature> <feature>...");
  });

  it("031:FR-019: the single-run subcommands are unchanged", async () => {
    const r = await runCommand(new FleetCommand(), tempProject({}), ["bogus"], {});
    expect(r.code).toBe(1);
    expect(r.err).toContain("Unknown fleet command 'bogus'");
  });
});

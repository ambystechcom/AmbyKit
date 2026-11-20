import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fleetRoot, listFleets } from "../../src/core/fleet/index.js";
import { THREE, fleetProject } from "../helpers/fleet-plan-fixture.js";
import { fakePort, fleetRun } from "../helpers/fleet-run-fixture.js";

describe("ambykit run <f1> <f2> (feature 031, US-1)", () => {
  it("031:FR-001: several features print one plan and start nothing without --yes", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "031", "032"], {});
    expect(r.code).toBe(0);
    expect(r.out).toContain("Fleet plan — 3 features");
    expect(r.out).toContain("1. 030-base");
    expect(r.out).toContain("2. 031-mid");
    expect(r.out).toContain("Nothing launched. Re-run with --yes");
    expect(existsSync(fleetRoot(root))).toBe(false);
  });

  it("031:FR-001: declining (no --yes) starts nothing: no fleet record, no run, no process", async () => {
    const root = fleetProject(THREE);
    const port = fakePort();
    await fleetRun(root, ["030", "031"], {}, { port });
    expect(listFleets(root)).toEqual([]);
    expect(port.starts).toHaveLength(0);
  });

  it("031:FR-001: --json prints the plan as one JSON document", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "031"], { json: true });
    const doc = JSON.parse(r.out) as { launched: boolean; features: { feature: string }[] };
    expect(doc.launched).toBe(false);
    expect(doc.features.map((f) => f.feature)).toEqual(["030-base", "031-mid"]);
  });

  it("031:FR-002: a feature that does not exist stops before starting and names it", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "099"], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain("099");
    expect(r.err).toContain("Nothing was started");
    expect(existsSync(fleetRoot(root))).toBe(false);
  });

  it("031:FR-002: a feature that is not ready stops before starting with the reason", async () => {
    const root = fleetProject([...THREE, { dir: "033-draft", status: "draft" }]);
    const r = await fleetRun(root, ["030", "033"], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain("033-draft is not ready to run: spec status is 'draft'");
  });

  it("031:FR-003: the same feature listed twice is one feature, so it is a single run, not a fleet", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "030-base"], {});
    expect(r.out).not.toContain("Fleet plan");
    expect(r.err).toContain("030-base has no prepared lanes"); // the single-run path ran, unchanged
  });

  it("031:FR-019: a fleet of one feature behaves as a single run", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["031"], {});
    expect(r.out).not.toContain("Fleet plan");
    expect(r.err).toContain("031-mid has no prepared lanes");
  });

  it("031:FR-008: a dependency cycle stops before starting and shows the cycle", async () => {
    const root = fleetProject([
      { dir: "030-a", dependsOn: ["031"] },
      { dir: "031-b", dependsOn: ["030"] },
    ]);
    const r = await fleetRun(root, ["030", "031"], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain("Dependency cycle");
  });

  it("031:FR-010: an unverified runner is refused before anything starts", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "031"], { yes: true, assistant: "claude" }, { registryVerified: false });
    expect(r.code).toBe(1);
    expect(r.err).toContain("Nothing was launched");
    expect(listFleets(root)).toEqual([]);
  });

  it("031:FR-001: the whole-fleet caps in the plan come from fleet.concurrency (default 3 and 2)", async () => {
    const root = fleetProject(THREE);
    const r = await fleetRun(root, ["030", "031"], {});
    expect(r.out).toContain("3 assistants at once, 2 of one type");
  });
});

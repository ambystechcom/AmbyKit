import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fleetRoot } from "../../src/core/fleet/index.js";
import { THREE, fleetProject } from "../helpers/fleet-plan-fixture.js";
import { fakePort, fleetRun } from "../helpers/fleet-run-fixture.js";

const MIXED = [...THREE, { dir: "033-draft", status: "draft" }, { dir: "034-noplan", plan: false }, { dir: "029-done", status: "done" }];

describe("ambykit run --all-ready (feature 031, US-7)", () => {
  it("031:FR-016: selects every ready feature and shows the chosen and the skipped ones with reasons", async () => {
    const r = await fleetRun(fleetProject(MIXED), [], { "all-ready": true }, { port: fakePort() });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Fleet plan — 3 features");
    expect(r.out).toContain("1. 030-base");
    expect(r.out).toContain("Skipped:");
    expect(r.out).toContain("033-draft — spec status is 'draft'");
    expect(r.out).toContain("034-noplan — no plan.md");
  });

  it("031:FR-016: a feature whose spec, plan and tasks are not all approved is skipped, never chosen", async () => {
    const r = await fleetRun(fleetProject(MIXED), [], { "all-ready": true, json: true });
    const doc = JSON.parse(r.out) as { features: { feature: string }[]; skipped: { feature: string; reason: string }[] };
    expect(doc.features.map((f) => f.feature)).not.toContain("033-draft");
    expect(doc.features.map((f) => f.feature)).not.toContain("034-noplan");
    expect(doc.skipped.map((s) => s.feature)).toEqual(["033-draft", "034-noplan"]);
  });

  it("031:FR-016: finished features are not listed as skipped", async () => {
    const r = await fleetRun(fleetProject(MIXED), [], { "all-ready": true });
    expect(r.out).not.toContain("029-done");
  });

  it("031:FR-016: with no ready feature it says so and starts nothing", async () => {
    const root = fleetProject([{ dir: "033-draft", status: "draft" }]);
    const port = fakePort();
    const r = await fleetRun(root, [], { "all-ready": true, yes: true, assistant: "claude" }, { port });
    expect(r.code).toBe(1);
    expect(r.err).toContain("No feature is ready to run, so nothing was started.");
    expect(port.starts).toHaveLength(0);
    expect(existsSync(fleetRoot(root))).toBe(false);
  });

  it("031:FR-001: without --yes the all-ready plan starts nothing", async () => {
    const root = fleetProject(MIXED);
    const r = await fleetRun(root, [], { "all-ready": true });
    expect(r.out).toContain("Nothing launched. Re-run with --yes to start this fleet.");
    expect(existsSync(fleetRoot(root))).toBe(false);
  });

  it("031:FR-016: --all-ready with a single ready feature is still a fleet plan (the person asked for all of them)", async () => {
    const r = await fleetRun(fleetProject([{ dir: "030-base" }, { dir: "033-draft", status: "draft" }]), [], { "all-ready": true });
    expect(r.out).toContain("Fleet plan — 1 feature");
  });
});

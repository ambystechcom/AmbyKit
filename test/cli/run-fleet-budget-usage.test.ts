import { describe, expect, it } from "vitest";
import { fakeRegistry } from "../helpers/run-fakes.js";
import { fleetRun } from "../helpers/fleet-run-fixture.js";
import { THREE, fleetProject } from "../helpers/fleet-plan-fixture.js";

describe("a token ceiling and runners that report no usage (feature 031, US-5)", () => {
  it("031:FR-011: the preview says the ceiling is not enforced when a runner reports no usage", async () => {
    const r = await fleetRun(fleetProject(THREE), ["030", "031"], { "max-tokens": "5000", assistant: "claude" });
    expect(r.out).toContain("Token ceiling: not enforceable for this fleet (a runner does not report usage)");
    expect(r.out).toContain("wall-clock and task budgets still apply");
  });

  it("031:FR-011: the JSON preview says so too", async () => {
    const r = await fleetRun(fleetProject(THREE), ["030", "031"], { "max-tokens": "5000", assistant: "claude", json: true });
    expect((JSON.parse(r.out) as { tokenCeilingEnforced: boolean }).tokenCeilingEnforced).toBe(false);
  });

  it("031:FR-011: when every runner reports usage the ceiling is enforced and nothing is said", async () => {
    const r = await fleetRun(fleetProject(THREE), ["030", "031"], { "max-tokens": "5000", assistant: "claude" }, { deps: { registry: fakeRegistry(["claude"], true) } });
    expect(r.out).not.toContain("Token ceiling");
    const json = await fleetRun(fleetProject(THREE), ["030", "031"], { "max-tokens": "5000", assistant: "claude", json: true }, { deps: { registry: fakeRegistry(["claude"], true) } });
    expect((JSON.parse(json.out) as { tokenCeilingEnforced: boolean }).tokenCeilingEnforced).toBe(true);
  });

  it("031:FR-011: with no token ceiling set nothing is said about one", async () => {
    const r = await fleetRun(fleetProject(THREE), ["030", "031"], { assistant: "claude" });
    expect(r.out).not.toContain("Token ceiling");
    expect(r.out).toContain("Budgets:");
  });

  it("031:FR-011: the plan shows the fleet budgets, including the ceiling when one is set", async () => {
    const r = await fleetRun(fleetProject(THREE), ["030", "031"], { "max-tokens": "5000", "max-minutes": "45", assistant: "claude" });
    expect(r.out).toContain("Budgets: 45 minutes");
    expect(r.out).toContain("5000 tokens");
  });
});

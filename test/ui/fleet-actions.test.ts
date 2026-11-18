import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { performFleetIntent, realFleetActions, type FleetActionDeps } from "../../src/cli/ui/interactive/fleet-actions.js";
import { directivePath, readDirective } from "../../src/core/fleet/directives.js";
import { FEATURE, fleetProject, fleetView } from "../helpers/fleet-fixture.js";

function fakes(failFor: string[] = []) {
  const calls: { lane: string; action: string; run?: string; feature: string }[] = [];
  const approvals: { run: string; gate?: string; by?: string }[] = [];
  const deps: FleetActionDeps = {
    writeDirective: (_root, input) => {
      calls.push({ lane: input.lane, action: input.action, run: input.run, feature: input.feature });
      return failFor.includes(input.lane)
        ? { ok: false, error: `lane '${input.lane}' not found` }
        : { ok: true, run: input.run ?? "", lane: input.lane, directive: { action: input.action, at: "t" } };
    },
    approveGate: (_root, run, input) => {
      approvals.push({ run, gate: input?.gate, by: input?.by });
      return { ok: true, run: {} as never, gate: { id: input?.gate ?? "", after: "", state: "approved" } };
    },
  };
  return { deps, calls, approvals };
}

const view = () => fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2" }, { lane: "lane-1-3" }]);

describe("fleet actions (feature 029, FR-006, FR-009)", () => {
  it("029:FR-006: a lane pause is one directive write for that lane, through the 025 writer", () => {
    const f = fakes();
    const r = performFleetIntent("/p", view(), { kind: "pause", target: { kind: "lane", lane: "lane-1-2" } }, f.deps);
    expect(f.calls).toEqual([{ lane: "lane-1-2", action: "pause", run: "001-alpha.1", feature: FEATURE }]);
    expect(r).toMatchObject({ ok: true, lanes: ["lane-1-2"] });
  });

  it("029:FR-006: a run-level action writes one directive per lane of the run", () => {
    const f = fakes();
    const r = performFleetIntent("/p", view(), { kind: "stop", target: { kind: "run", run: "001-alpha.1" } }, f.deps);
    expect(f.calls.map((c) => [c.lane, c.action])).toEqual([["lane-1-1", "stop"], ["lane-1-2", "stop"], ["lane-1-3", "stop"]]);
    expect(r.message).toMatch(/3 lanes/);
  });

  it("029:FR-006: resume writes a continue directive (resume is not a directive action)", () => {
    const f = fakes();
    performFleetIntent("/p", view(), { kind: "resume", target: { kind: "lane", lane: "lane-1-1" } }, f.deps);
    expect(f.calls[0]?.action).toBe("continue");
  });

  it("029:FR-006: one lane failing does not stop the others, and the failure is reported", () => {
    const f = fakes(["lane-1-2"]);
    const r = performFleetIntent("/p", view(), { kind: "pause", target: { kind: "run", run: "001-alpha.1" } }, f.deps);
    expect(f.calls).toHaveLength(3);
    expect(r).toMatchObject({ ok: true, lanes: ["lane-1-1", "lane-1-3"] });
    expect(r.message).toMatch(/1 of 3 failed/);
  });

  it("029:FR-009: approve calls 028's approveGate and writes no directive", () => {
    const f = fakes();
    const r = performFleetIntent("/p", view(), { kind: "approve", run: "001-alpha.1", gate: "phase-1" }, f.deps);
    expect(f.approvals).toEqual([{ run: "001-alpha.1", gate: "phase-1", by: "person (dashboard)" }]);
    expect(f.calls).toEqual([]);
    expect(r).toMatchObject({ ok: true, message: "Approved phase-1." });
  });

  it("029:FR-006: against real state, last write wins: pause then continue leaves a continue directive", () => {
    const fx = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    const v = fleetView([{ lane: "lane-1-1" }], { run: fx.run });
    const target = { kind: "lane", lane: "lane-1-1" } as const;
    performFleetIntent(fx.root, v, { kind: "pause", target }, realFleetActions);
    expect(readDirective(fx.root, fx.run, "lane-1-1")?.action).toBe("pause");
    performFleetIntent(fx.root, v, { kind: "resume", target }, realFleetActions);
    expect(readDirective(fx.root, fx.run, "lane-1-1")?.action).toBe("continue");
    expect(JSON.parse(readFileSync(directivePath(fx.root, fx.run, "lane-1-1"), "utf8"))).toMatchObject({ action: "continue" });
  });

  it("029:FR-006: against real state, a lane the run does not know is an error line, not a crash", () => {
    const fx = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "working" }]);
    const v = fleetView([{ lane: "lane-9-9" }], { run: fx.run });
    const r = performFleetIntent(fx.root, v, { kind: "pause", target: { kind: "lane", lane: "lane-9-9" } }, realFleetActions);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not found/);
  });
});

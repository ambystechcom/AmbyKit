import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initFleetState, pendingGates, reduceFleet } from "../../src/cli/ui/interactive/fleet.js";
import { performFleetIntent, realFleetActions } from "../../src/cli/ui/interactive/fleet-actions.js";
import { readFleet } from "../../src/core/fleet-view/read.js";
import { directivesDir, readRun } from "../../src/core/fleet/index.js";
import { NOW, fleetProject, fleetView } from "../helpers/fleet-fixture.js";

const key = { name: "a", sequence: "a" } as const;
const gate = (id: string, state: "pending" | "approved" = "pending") => ({ id, after: `US-${id.at(-1)}`, state });

describe("fleet gates (feature 029, FR-009)", () => {
  it("029:FR-009: pending gates are listed together; approved ones are not", () => {
    const v = fleetView([{}], { gates: [gate("phase-1"), gate("phase-2", "approved"), gate("phase-3")] });
    expect(pendingGates(v).map((g) => g.id)).toEqual(["phase-1", "phase-3"]);
  });

  it("029:FR-009: a with one gate waiting records an approve intent for it; no prompt", () => {
    const v = fleetView([{}], { gates: [gate("phase-1")] });
    expect(reduceFleet(v, initFleetState(), key).intent).toEqual({ kind: "approve", run: "001-alpha.1", gate: "phase-1" });
  });

  it("029:FR-009: with several gates, a approves the one under the gate cursor", () => {
    const v = fleetView([{}], { gates: [gate("phase-1"), gate("phase-2")] });
    expect(reduceFleet(v, { ...initFleetState(), gateCursor: 1 }, key).intent).toEqual({ kind: "approve", run: "001-alpha.1", gate: "phase-2" });
  });

  it("029:FR-009: with no gate waiting, a says so and records nothing", () => {
    const s = reduceFleet(fleetView([{}]), initFleetState(), key);
    expect(s.intent).toBeNull();
    expect(s.notice).toMatch(/No gate/);
  });

  it("029:FR-009: declining or leaving writes nothing: esc goes back with no intent and the gate stays pending", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "paused" }], { status: "waiting-person", gates: [gate("phase-1")] });
    const v = readFleet(f.root, NOW)!;
    const s = reduceFleet(v, initFleetState(), { name: "escape" });
    expect(s).toMatchObject({ back: true, intent: null });
    expect(readRun(f.root, f.run)!.gates[0]?.state).toBe("pending");
  });

  it("029:FR-009: approving releases 028's gate through approveGate and writes no directive file", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "paused" }], { status: "waiting-person", needsDecision: true, gates: [gate("phase-1")] });
    const v = readFleet(f.root, NOW)!;
    expect(v.run.gates).toEqual([gate("phase-1")]);
    const intent = reduceFleet(v, initFleetState(), key).intent!;
    const r = performFleetIntent(f.root, v, intent, realFleetActions);
    expect(r).toMatchObject({ ok: true, message: "Approved phase-1." });
    const rec = readRun(f.root, f.run)!;
    expect(rec.gates[0]?.state).toBe("approved");
    expect(rec.status).toBe("active");
    expect(rec.approvals).toHaveLength(1);
    const dir = directivesDir(f.root, f.run);
    expect(!existsSync(dir) || readdirSync(join(dir)).length === 0).toBe(true);
  });

  it("029:FR-009: approving an unknown gate reports the error and changes nothing", () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 1, state: "paused" }], { status: "waiting-person", gates: [gate("phase-1")] });
    const v = readFleet(f.root, NOW)!;
    const r = performFleetIntent(f.root, v, { kind: "approve", run: f.run, gate: "phase-9" }, realFleetActions);
    expect(r.ok).toBe(false);
    expect(readRun(f.root, f.run)!.gates[0]?.state).toBe("pending");
  });
});

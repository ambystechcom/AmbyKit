import { describe, expect, it } from "vitest";
import { initFleetState, reduceFleet } from "../../src/cli/ui/interactive/fleet.js";
import type { KeyEvent } from "../../src/cli/ui/interactive/fullscreen.js";
import { fleetView } from "../helpers/fleet-fixture.js";

const k = (ch: string): KeyEvent => ({ name: ch.toLowerCase(), sequence: ch, shift: ch !== ch.toLowerCase() });
const view = () =>
  fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2", state: "paused", directive: { action: "pause", status: "paused" } }]);

describe("fleet reducer: controls and confirmation (feature 029, FR-006, FR-008)", () => {
  it("029:FR-006: p and c on a lane record an intent for that lane without asking", () => {
    const paused = fleetView([{ lane: "lane-1-1", state: "paused", directive: { action: "pause", status: "paused" } }]);
    expect(reduceFleet(paused, initFleetState(), k("c")).intent).toEqual({ kind: "resume", target: { kind: "lane", lane: "lane-1-1" } });
    expect(reduceFleet(view(), initFleetState(), k("p")).intent).toEqual({ kind: "pause", target: { kind: "lane", lane: "lane-1-1" } });
  });

  it("029:FR-008: stop asks first; y confirms and records the intent", () => {
    const asked = reduceFleet(view(), initFleetState(), k("x"));
    expect(asked.intent).toBeNull();
    expect(asked.confirm).toEqual({ kind: "stop", target: { kind: "lane", lane: "lane-1-1" } });
    const done = reduceFleet(view(), asked, k("y"));
    expect(done).toMatchObject({ confirm: null, intent: { kind: "stop", target: { kind: "lane", lane: "lane-1-1" } } });
  });

  it("029:FR-008: any other key cancels the confirmation and writes nothing", () => {
    const asked = reduceFleet(view(), initFleetState(), k("x"));
    for (const other of [k("n"), k("escape"), k("x"), k("a"), k("Y")]) {
      expect(reduceFleet(view(), asked, other)).toMatchObject({ confirm: null, intent: null });
    }
  });

  it("029:FR-006: shifted keys act on the whole run and always ask first, even pause and continue", () => {
    for (const [key, kind] of [["P", "pause"], ["C", "resume"], ["X", "stop"]] as const) {
      const s = reduceFleet(view(), initFleetState(), k(key));
      expect(s.intent).toBeNull();
      expect(s.confirm).toEqual({ kind, target: { kind: "run", run: "001-alpha.1" } });
    }
  });

  it("029:FR-007: pausing a lane that is already pausing or paused writes nothing and says so", () => {
    const s = reduceFleet(view(), { ...initFleetState(), cursor: 1 }, k("p"));
    expect(s.intent).toBeNull();
    expect(s.notice).toMatch(/already paused/);
  });

  it("029:FR-006: continue on a lane that is not paused says so; continue after a pause replaces it", () => {
    expect(reduceFleet(view(), initFleetState(), k("c")).notice).toMatch(/not paused/);
    expect(reduceFleet(view(), { ...initFleetState(), cursor: 1 }, k("c")).intent).toEqual({ kind: "resume", target: { kind: "lane", lane: "lane-1-2" } });
  });

  it("029:FR-006: with no lane selected there is no lane action", () => {
    const s = reduceFleet(fleetView([]), initFleetState(), k("x"));
    expect(s).toMatchObject({ confirm: null, intent: null });
    expect(s.notice).toMatch(/No lane/);
  });

  it("029:FR-008: Ctrl-C quits, and cancels an open confirmation without writing", () => {
    expect(reduceFleet(view(), initFleetState(), { name: "c", ctrl: true }).quit).toBe(true);
    const asked = reduceFleet(view(), initFleetState(), k("x"));
    expect(reduceFleet(view(), asked, { name: "c", ctrl: true })).toMatchObject({ confirm: null, intent: null });
  });
});

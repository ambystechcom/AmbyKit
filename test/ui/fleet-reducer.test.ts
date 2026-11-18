import { describe, expect, it } from "vitest";
import { clampFleet, initFleetState, reduceFleet, scrollFor } from "../../src/cli/ui/interactive/fleet.js";
import type { KeyEvent } from "../../src/cli/ui/interactive/fullscreen.js";
import { fleetView } from "../helpers/fleet-fixture.js";

const k = (name: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({ name, sequence: name.length === 1 ? name : undefined, ...extra });
const many = (n: number) => fleetView(Array.from({ length: n }, () => ({})));

describe("fleet reducer: navigation (feature 029, FR-001)", () => {
  it("029:FR-001: up and down move the lane cursor and stop at both ends", () => {
    const v = many(3);
    let s = initFleetState();
    s = reduceFleet(v, s, k("up"));
    expect(s.cursor).toBe(0);
    s = reduceFleet(v, reduceFleet(v, reduceFleet(v, s, k("down")), k("down")), k("down"));
    expect(s.cursor).toBe(2);
  });

  it("029:FR-001: the scroll offset follows the cursor in a short terminal and never passes the end", () => {
    const v = many(10);
    let s = initFleetState();
    for (let i = 0; i < 9; i++) s = reduceFleet(v, s, k("down"), 4);
    expect(s.cursor).toBe(9);
    expect(s.scroll).toBe(6);
    for (let i = 0; i < 9; i++) s = reduceFleet(v, s, k("up"), 4);
    expect(s).toMatchObject({ cursor: 0, scroll: 0 });
    expect(scrollFor(9, 0, 4, 10)).toBe(6);
    expect(scrollFor(2, 8, 4, 10)).toBe(2);
  });

  it("029:FR-001: esc and left go back; q quits; with no run the keys do nothing harmful", () => {
    const v = many(2);
    expect(reduceFleet(v, initFleetState(), k("escape")).back).toBe(true);
    expect(reduceFleet(v, initFleetState(), k("left")).back).toBe(true);
    expect(reduceFleet(v, initFleetState(), k("q")).quit).toBe(true);
    expect(reduceFleet(null, initFleetState(), k("down"))).toMatchObject({ cursor: 0, intent: null, confirm: null });
    expect(reduceFleet(null, initFleetState(), k("escape")).back).toBe(true);
  });

  it("029:FR-003: after a refresh that drops lanes, the cursor is clamped", () => {
    const s = { ...initFleetState(), cursor: 7, scroll: 5 };
    expect(clampFleet(many(3), s, 10)).toMatchObject({ cursor: 2, scroll: 0 });
    expect(clampFleet(null, s)).toMatchObject({ cursor: 0, scroll: 0 });
  });

  it("029:FR-001: with several gates waiting, left and right move the gate cursor instead of leaving", () => {
    const gates = [
      { id: "phase-1", after: "US-1", state: "pending" as const },
      { id: "phase-2", after: "US-2", state: "pending" as const },
    ];
    const v = fleetView([{}], { gates });
    let s = reduceFleet(v, initFleetState(), k("right"));
    expect(s.gateCursor).toBe(1);
    s = reduceFleet(v, s, k("left"));
    expect(s).toMatchObject({ gateCursor: 0, back: false });
  });
});

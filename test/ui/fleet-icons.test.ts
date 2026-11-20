import { describe, expect, it } from "vitest";
import { renderFleet, stateGlyph } from "../../src/cli/ui/dashboard/fleet-view.js";
import { FLEET_TOKENS } from "../../src/cli/ui/dashboard/fleet-tokens.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import type { LaneViewState } from "../../src/core/fleet-view/types.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const STATES: LaneViewState[] = ["working", "waiting", "blocked", "paused", "done", "unreported", "unknown"];
const WORD: Record<string, string> = FLEET_TOKENS.word;

const CAPS = {
  "wide nerd": fakeCapabilities({ columns: 120, icons: "nerd" }),
  "wide unicode": fakeCapabilities({ columns: 120 }),
  "wide ascii": fakeCapabilities({ columns: 120, icons: "ascii" }),
  "wide NO_COLOR": fakeCapabilities({ columns: 120, color: false }),
  "compact unicode": fakeCapabilities({ columns: 50 }),
  "compact ascii": fakeCapabilities({ columns: 50, unicode: false }),
  "plain non-TTY": fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 80 }),
};

describe("fleet view: every state in every icon mode and width reads by word (feature 029, FR-010, SC-004)", () => {
  for (const [name, caps] of Object.entries(CAPS)) {
    it(`029:FR-010: ${name}: each state shows its word and no row exceeds the width`, () => {
      const view = fleetView(STATES.map((state, i) => ({ lane: `lane-1-${i + 1}`, state })));
      const out = stripAnsi(renderFleet(caps, { view, state: initFleetState(), now: NOW, rows: 40 }));
      for (const state of STATES) expect(out).toContain(WORD[state]);
      if (caps.isTTY) for (const line of out.split("\n")) expect([...line].length).toBeLessThanOrEqual(caps.columns);
    });
  }

  it("029:FR-010: the ASCII set carries no non-ASCII state glyph, so no state depends on glyph support", () => {
    for (const state of STATES) expect(stateGlyph(fakeCapabilities({ unicode: false, columns: 80 }), state)).toMatch(/^[\x20-\x7e]+$/);
  });

  it("029:FR-010: Nerd mode reuses the Unicode glyph (signed-off default); ascii and unicode differ", () => {
    for (const state of STATES) {
      expect(stateGlyph(fakeCapabilities({ icons: "nerd" }), state)).toBe(stateGlyph(fakeCapabilities(), state));
      expect(stateGlyph(fakeCapabilities({ icons: "ascii" }), state)).not.toBe(stateGlyph(fakeCapabilities(), state));
    }
  });

  it("029:FR-010: the sign-off avoids ⏸ (some terminals draw it two cells wide)", () => {
    const all = JSON.stringify(FLEET_TOKENS.glyph);
    expect(all).not.toContain("⏸");
  });

  it("029:SC-004: an unknown state value from newer data falls back to the unknown row, not a crash", () => {
    const view = fleetView([{ lane: "lane-1-1", state: "exploding" as never }]);
    const out = stripAnsi(renderFleet(fakeCapabilities({ columns: 120 }), { view, state: initFleetState(), now: NOW, rows: 24 }));
    expect(out).toContain("unknown");
  });
});

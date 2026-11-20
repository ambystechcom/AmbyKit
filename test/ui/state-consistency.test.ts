import { describe, expect, it } from "vitest";
import { FLEET_TOKENS } from "../../src/cli/ui/dashboard/fleet-tokens.js";
import { TAB_TOKENS } from "../../src/cli/ui/dashboard/tab-tokens.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { fleetViewApi, stateCell } from "../../src/cli/ui/dashboard/fleet-view.js";
import { featureOf, fleetsOf, lane, tabData } from "../helpers/tabs-fixture.js";
import { fleetView } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/** Feature 032, US-7 / FR-015: a state looks the same everywhere: one word, one glyph pair and one color per state. */

const STATES = ["working", "waiting", "blocked", "paused", "done"] as const;
const plain = fakeCapabilities({ color: false, columns: 120 });
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: string[]) => keys.reduce((st, k) => reduceOverviewTui(d, st, { name: k, sequence: k.length === 1 ? k : undefined }), s);

describe("one state vocabulary (feature 032, FR-015)", () => {
  it("032:FR-015: the shared state tokens are 029's lane tokens (same word, glyph and color)", () => {
    for (const s of STATES) {
      const shared = TAB_TOKENS.semantic.state[s];
      const lane = FLEET_TOKENS.component["fleet-lane"].state[s];
      expect(shared.word).toBe(lane.word);
      expect(shared.glyph).toEqual(lane.glyph);
      expect(shared.fg).toEqual(lane.fg);
    }
    expect(TAB_TOKENS.semantic.state.stalled.word).toBe(FLEET_TOKENS.component["fleet-lane"].stalled.text);
    expect(TAB_TOKENS.semantic.state.stalled.fg).toEqual(FLEET_TOKENS.component["fleet-lane"].stalled.fg);
  });

  it("032:FR-015: every state renders as the same glyph and word in the single-run fleet tab and in the grouped fleet tab", () => {
    const lanes = STATES.map((s, i) => lane(`lane-1-${i + 1}`, s));
    const single = tabData({ fleet: fleetView(lanes.map((l) => ({ lane: l.lane, state: l.state }))) });
    const grouped = tabData({ fleets: fleetsOf([featureOf("030-a", "running", lanes), featureOf("031-b", "running", [lane("lane-1-1")])]) });
    const a = stripAnsi(renderOverviewTui(plain, single, press(single, initOverviewTui(), "2")));
    const g = stripAnsi(renderOverviewTui(plain, grouped, press(grouped, initOverviewTui(), "2")));
    for (const s of STATES) {
      const cell = stripAnsi(stateCell(plain, s)).trimEnd();
      expect(a, `single ${s}`).toContain(cell);
      expect(g, `grouped ${s}`).toContain(cell);
    }
  });

  it("032:FR-015: a feature's header uses the same glyph and word as a lane in that state", () => {
    const grouped = tabData({ fleets: fleetsOf([featureOf("030-a", "done", [lane("lane-1-1", "done")]), featureOf("031-b", "running", [lane("lane-1-1")]), featureOf("032-c", "paused", [lane("lane-1-1", "paused")], { cause: "lane failed" })]) });
    const out = stripAnsi(renderOverviewTui(plain, grouped, press(grouped, initOverviewTui(), "2")));
    for (const s of ["done", "working", "paused"] as const) {
      const t = TAB_TOKENS.semantic.state[s];
      expect(out).toContain(`${t.glyph.u} ${t.word}`);
    }
  });

  it("032:FR-012: every state has a word, so no state depends on a glyph or a color (ASCII, no color)", () => {
    const lanes = STATES.map((s, i) => lane(`lane-1-${i + 1}`, s));
    const d = tabData({ fleets: fleetsOf([featureOf("030-a", "running", lanes), featureOf("031-b", "running", [lane("lane-1-1")])]) });
    const out = stripAnsi(renderOverviewTui(fakeCapabilities({ color: false, unicode: false, columns: 120 }), d, press(d, initOverviewTui(), "2")));
    for (const s of STATES) expect(out).toContain(TAB_TOKENS.semantic.state[s].word);
    expect(fleetViewApi).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { laneLine, renderFleet } from "../../src/cli/ui/dashboard/fleet-view.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const stalled = fleetView([{ lane: "lane-1-1", state: "working", stalled: true, idle: 18 }, { lane: "lane-1-2", state: "working", idle: 2 }]);
const frame = (caps = fakeCapabilities({ columns: 120 }), view = stalled) => renderFleet(caps, { view, state: initFleetState(), now: NOW, rows: 24 });

describe("fleet view: stalled lanes (feature 029, FR-005)", () => {
  it("029:FR-005: a stalled lane carries the text STALLED and its quiet minutes; a healthy lane does not", () => {
    const lines = stripAnsi(frame()).split("\n");
    expect(lines.find((l) => l.includes("lane-1-1"))).toContain("STALLED 18m");
    expect(lines.find((l) => l.includes("lane-1-2"))).not.toContain("STALLED");
  });

  it("029:FR-005: the highlight is readable without color: the text survives NO_COLOR and plain output", () => {
    for (const caps of [fakeCapabilities({ columns: 120, color: false }), fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 80 })]) {
      const out = frame(caps);
      expect(hasAnsi(out)).toBe(false);
      expect(out).toContain("STALLED 18m");
    }
  });

  it("029:FR-005: with color it is also painted, as reinforcement (not the only signal)", () => {
    expect(hasAnsi(frame())).toBe(true);
  });

  it("029:FR-005: it clears once the next read says the lane is no longer stalled", () => {
    const cleared = fleetView([{ lane: "lane-1-1", state: "working", stalled: false, idle: 0 }]);
    expect(stripAnsi(frame(undefined, cleared))).not.toContain("STALLED");
  });

  it("029:FR-005: the stalled text sits with the directive words (STALLED first)", () => {
    const v = fleetView([{ lane: "lane-1-1", state: "working", stalled: true, idle: 21, directive: { action: "pause", status: "pause requested" } }]);
    expect(stripAnsi(frame(undefined, v))).toContain("STALLED 21m · pause requested");
  });

  it("029:FR-005: a waiting, paused or done lane is never drawn stalled (the view trusts laneStatus)", () => {
    const v = fleetView([{ state: "waiting", idle: 99 }, { state: "paused", idle: 99 }, { state: "done", idle: 99 }]);
    expect(stripAnsi(frame(undefined, v))).not.toContain("STALLED");
  });

  it("029:FR-005: in a compact terminal the state word is intact and STALLED is cut last of the extras", () => {
    const line = stripAnsi(laneLine(fakeCapabilities({ columns: 50 }), stalled.lanes[0]!, false, "compact"));
    expect(line).toContain("working");
    expect(line).toContain("STALLED 18m");
  });
});

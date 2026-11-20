import { describe, expect, it } from "vitest";
import { directiveText, renderFleet } from "../../src/cli/ui/dashboard/fleet-view.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ columns: 120, color: false });
const frame = (view = fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2", assistant: "codex" }]), state = initFleetState()) => stripAnsi(renderFleet(caps, { view, state, now: NOW, rows: 24 }));

describe("fleet view: directive status and confirmation (feature 029, FR-006, FR-007, FR-008)", () => {
  it("029:FR-007: each directive status is a word in the DIRECTIVE column, '—' when none", () => {
    const view = fleetView([
      { lane: "lane-1-1", directive: { action: "continue", status: "none" } },
      { lane: "lane-1-2", directive: { action: "continue", status: "pending" } },
      { lane: "lane-1-3", directive: { action: "pause", status: "pause requested" } },
      { lane: "lane-1-4", state: "paused", directive: { action: "pause", status: "paused" } },
      { lane: "lane-1-5", directive: { action: "stop", status: "pending" } },
      { lane: "lane-1-6", directive: { action: "continue", status: "obeyed" } },
    ]);
    const lines = frame(view).split("\n");
    const row = (lane: string) => lines.find((l) => l.includes(lane))!;
    expect(row("lane-1-1")).toMatch(/—\s*│/);
    expect(row("lane-1-2")).toContain("continue pending");
    expect(row("lane-1-3")).toContain("pause requested");
    expect(row("lane-1-4")).toMatch(/paused\s+\d*m?\s*paused|paused\s+-\s+paused/);
    expect(row("lane-1-5")).toContain("stop pending");
    expect(row("lane-1-6")).toContain("obeyed");
  });

  it("029:FR-007: directiveText is null when nothing waits on a directive", () => {
    expect(directiveText(fleetView([{}]).lanes[0]!)).toBeNull();
  });

  it("029:FR-008: a stop confirmation names the lane and its assistant and says y confirms, n cancels", () => {
    const out = frame(undefined, { ...initFleetState(), confirm: { kind: "stop", target: { kind: "lane", lane: "lane-1-2" } } });
    expect(out).toContain("STOP LANE");
    expect(out).toContain("Stop lane-1-2 (◎ Codex)?");
    expect(out).toContain("The worker finishes its current task first.");
    expect(out).toContain("y confirm · n cancel");
  });

  it("029:FR-008: whole-run confirmations say all lanes, with the lane count and the run", () => {
    const view = fleetView([{}, {}, {}]);
    for (const [kind, title] of [["pause", "PAUSE ALL LANES"], ["resume", "CONTINUE ALL LANES"], ["stop", "STOP ALL LANES"]] as const) {
      const out = frame(view, { ...initFleetState(), confirm: { kind, target: { kind: "run", run: "001-alpha.1" } } });
      expect(out).toContain(title);
      expect(out).toMatch(/all 3 lanes of 001-alpha\.1\?/);
    }
  });

  it("029:FR-008: the dialog fits its text (no cut words) and the terminal width", () => {
    const out = frame(fleetView([{}, {}]), { ...initFleetState(), confirm: { kind: "stop", target: { kind: "run", run: "019-amby-run-prompt.12" } } });
    expect(out).toContain("Each worker finishes its current task first.");
    for (const line of out.split("\n")) expect([...line].length).toBeLessThanOrEqual(120);
  });

  it("029:FR-008: in plain output the confirmation is a labelled line, not an overlay", () => {
    const plain = fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 80 });
    const out = stripAnsi(renderFleet(plain, { view: fleetView([{}]), state: { ...initFleetState(), confirm: { kind: "stop", target: { kind: "lane", lane: "lane-1-1" } } }, now: NOW, rows: 24 }));
    expect(out).toMatch(/STOP LANE: Stop lane-1-1/);
    expect(out).toContain("y confirm, n cancel");
  });

  it("029:FR-006: the notice of the last action shows under the frame", () => {
    expect(frame(undefined, { ...initFleetState(), notice: "Wrote pause for lane-1-1." })).toContain("Wrote pause for lane-1-1.");
  });
});

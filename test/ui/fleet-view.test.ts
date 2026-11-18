import { describe, expect, it } from "vitest";
import { renderFleet, windowRows } from "../../src/cli/ui/dashboard/fleet-view.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const render = (caps = fakeCapabilities({ columns: 120 }), view = fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2", assistant: "codex" }]), state = initFleetState(), rows = 24) =>
  renderFleet(caps, { view, state, now: NOW, rows });
const text = (s: string) => stripAnsi(s);

describe("fleet view renderer (feature 029, FR-001, FR-003)", () => {
  it("029:FR-001: wide: every lane is a row with assistant, state word and quiet time, under a framed header", () => {
    const view = fleetView([
      { lane: "lane-2-1", assistant: "claude", state: "working", idle: 1 },
      { lane: "lane-2-2", assistant: "codex", state: "waiting", idle: 4 },
    ], { run: "019-amby-run-prompt.1", phase: 2 });
    const out = text(render(fakeCapabilities({ columns: 120 }), view));
    expect(out).toContain("FLEET · 019-amby-run-prompt.1 · phase 2 · working");
    expect(out).toMatch(/lane-2-1\s+✸ Claude\s+▶ working\s+1m/);
    expect(out).toMatch(/lane-2-2\s+◎ Codex\s+◷ waiting\s+4m/);
    expect(out).toContain("LANE");
    expect(out).toContain("ASSISTANT");
  });

  it("029:FR-001: two lanes of the same assistant are two distinct rows", () => {
    const out = text(render(fakeCapabilities({ columns: 120 }), fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2" }])));
    expect(out).toContain("lane-1-1");
    expect(out).toContain("lane-1-2");
    expect(out.match(/✸ Claude/g)).toHaveLength(2);
  });

  it("029:FR-001: the cursor row is marked with the cursor glyph", () => {
    const out = text(render(fakeCapabilities({ columns: 120 }), undefined, { ...initFleetState(), cursor: 1 }));
    const lines = out.split("\n");
    expect(lines.find((l) => l.includes("lane-1-2"))).toMatch(/▸/);
    expect(lines.find((l) => l.includes("lane-1-1"))).not.toMatch(/▸/);
  });

  it("029:FR-003: an unknown lane says unknown, and an unreported one says unreported with '-' for quiet time", () => {
    const view = fleetView([{ lane: "lane-1-1", state: "unknown" }, { lane: "lane-1-2", state: "unreported" }]);
    const out = text(render(fakeCapabilities({ columns: 120 }), view));
    expect(out).toMatch(/lane-1-1\s+✸ Claude\s+\? unknown\s+-/);
    expect(out).toMatch(/lane-1-2\s+✸ Claude\s+· unreported\s+-/);
  });

  it("029:FR-013: with no run the view says so and how to start one", () => {
    const out = text(renderFleet(fakeCapabilities({ columns: 120 }), { view: null, state: initFleetState(), now: NOW, rows: 24 }));
    expect(out).toContain("No fleet run is active.");
    expect(out).toContain("ambykit fleet start <feature>");
  });

  it("029:FR-001: compact (under 60 columns): the assistant is its glyph and the state word is never cut", () => {
    const view = fleetView([{ lane: "lane-2-2", assistant: "codex", state: "working", stalled: true, idle: 21, directive: { action: "pause", status: "pause requested" } }]);
    const out = text(render(fakeCapabilities({ columns: 50 }), view));
    expect(out).toMatch(/lane-2-2\s+◎\s+▶ working/);
    expect(out).not.toContain("Codex");
    for (const line of out.split("\n")) expect([...line].length).toBeLessThanOrEqual(50);
  });

  it("029:FR-010: plain (not a terminal): no frame, no ANSI, ASCII glyphs and the same words", () => {
    const view = fleetView([{ lane: "lane-2-2", assistant: "codex", state: "working", idle: 21, stalled: true, directive: { action: "pause", status: "pause requested" } }], { phase: 2, stage: "qa", round: 1, limit: 3 });
    const out = render(fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 80 }), view);
    expect(hasAnsi(out)).toBe(false);
    expect(out).toMatch(/^FLEET 001-alpha\.1 {2}phase 2 {2}stage QA round 1\/3/);
    expect(out).toContain("> lane-2-2");
    expect(out).toContain("[CX] Codex");
    expect(out).toContain("[>] working");
    expect(out).toContain("STALLED 21m");
    expect(out).toContain("pause requested");
    expect(out).not.toMatch(/[┏┃┗━│┌└]/);
  });

  it("029:FR-010: NO_COLOR keeps the frame but emits no ANSI", () => {
    const out = render(fakeCapabilities({ columns: 100, color: false }));
    expect(hasAnsi(out)).toBe(false);
    expect(out).toContain("FLEET");
  });

  it("029:FR-001: with colors on, the stalled and state words are painted", () => {
    expect(hasAnsi(render(fakeCapabilities({ columns: 120 })))).toBe(true);
  });

  it("029:FR-001: more lanes than rows scroll with the cursor and say how many are hidden", () => {
    const view = fleetView(Array.from({ length: 30 }, () => ({})));
    const top = text(render(fakeCapabilities({ columns: 120 }), view, initFleetState(), 16));
    const rowsShown = windowRows(16, view);
    expect(top.match(/lane-1-/g)).toHaveLength(rowsShown);
    expect(top).toContain(`↓ ${30 - rowsShown} more`);
    expect(top).not.toContain("↑");
    const bottom = text(render(fakeCapabilities({ columns: 120 }), view, { ...initFleetState(), cursor: 29, scroll: 30 - rowsShown }, 16));
    expect(bottom).toContain(`↑ ${30 - rowsShown} more`);
    expect(bottom).toContain("lane-1-30");
  });

  it("029:FR-001: a short terminal still shows at least the minimum rows", () => {
    expect(windowRows(5, fleetView([{}]))).toBe(4);
  });

  it("029:FR-001: the live indicator is part of the header when live mode is on", () => {
    const out = text(renderFleet(fakeCapabilities({ columns: 120 }), { view: fleetView([{}]), state: initFleetState(), live: { mode: "watching", lastChange: NOW - 3000 }, now: NOW, rows: 24 }));
    expect(out).toContain("live");
  });

  it("029:FR-003: a notice from the last action appears under the frame", () => {
    const out = text(render(fakeCapabilities({ columns: 120 }), undefined, { ...initFleetState(), notice: "lane-1-1 is not paused." }));
    expect(out).toContain("lane-1-1 is not paused.");
  });
});

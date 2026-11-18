import { describe, expect, it } from "vitest";
import { renderFleet } from "../../src/cli/ui/dashboard/fleet-view.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ columns: 120, color: false });
const frame = (gates: { id: string; after: string; state: "pending" | "approved" }[], state = initFleetState(), c = caps) =>
  stripAnsi(renderFleet(c, { view: fleetView([{ state: "paused" }], { gates, status: "waiting-person" }), state, now: NOW, rows: 24 }));

describe("fleet view: gates (feature 029, FR-009)", () => {
  it("029:FR-009: a gate waiting for approval is listed with the story it follows", () => {
    const out = frame([{ id: "phase-2", after: "US-3", state: "pending" }]);
    expect(out).toContain("GATES");
    expect(out).toContain("phase-2 · after US-3 · awaiting approval");
  });

  it("029:FR-009: several waiting gates are listed together so none is missed, with a cursor on the selected one", () => {
    const gates = [
      { id: "phase-1", after: "US-1", state: "pending" as const },
      { id: "phase-2", after: "US-2", state: "pending" as const },
    ];
    const lines = frame(gates, { ...initFleetState(), gateCursor: 1 }).split("\n");
    expect(lines.find((l) => l.includes("phase-1"))).not.toMatch(/▸/);
    expect(lines.find((l) => l.includes("phase-2"))).toMatch(/▸/);
  });

  it("029:FR-009: an approved gate is shown as approved (muted), and only the last two are kept", () => {
    const gates = [1, 2, 3, 4].map((n) => ({ id: `phase-${n}`, after: `US-${n}`, state: "approved" as const }));
    const out = frame(gates);
    expect(out).toContain("phase-4 · after US-4 · approved");
    expect(out).toContain("phase-3 · after US-3 · approved");
    expect(out).not.toContain("phase-1 ");
  });

  it("029:FR-009: with no gates there is no GATES section", () => {
    expect(frame([])).not.toContain("GATES");
  });

  it("029:FR-009: plain output lists gates as a GATES: line with no frame", () => {
    const plain = fakeCapabilities({ isTTY: false, color: false, unicode: false, columns: 80 });
    const out = frame([{ id: "phase-2", after: "US-3", state: "pending" }], initFleetState(), plain);
    expect(out).toContain("GATES: phase-2, after US-3, awaiting approval");
  });
});

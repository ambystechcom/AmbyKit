import { describe, expect, it } from "vitest";
import { headerText, renderFleet, stageLabel } from "../../src/cli/ui/dashboard/fleet-view.js";
import { initFleetState } from "../../src/cli/ui/interactive/fleet.js";
import { fleetView, NOW } from "../helpers/fleet-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ columns: 120 });
const header = (run: Parameters<typeof fleetView>[1], others: string[] = []) => {
  const v = fleetView([{}], run);
  v.others = others;
  return stripAnsi(renderFleet(caps, { view: v, state: initFleetState(), now: NOW, rows: 24 })).split("\n")[0]!;
};

describe("fleet view: review-loop state in the run header (feature 029, FR-004)", () => {
  it("029:FR-004: working, QA and architect review each read as a word with the round against the limit", () => {
    expect(header({ stage: "working" })).toContain("· working");
    expect(header({ stage: "qa", round: 1, limit: 3 })).toContain("QA round 1/3");
    expect(header({ stage: "architect", round: 2, limit: 3 })).toContain("architect round 2/3");
  });

  it("029:FR-004: a run waiting on a person after the round limit says NEEDS A DECISION in words", () => {
    const h = header({ stage: "architect", round: 3, limit: 3, needsDecision: true });
    expect(h).toContain("architect round 3/3");
    expect(h).toContain("NEEDS A DECISION");
  });

  it("029:FR-004: a run with no review data reads as working, not an error", () => {
    const h = header({ stage: "working", round: 0, limit: 0 });
    expect(h).toContain("· working");
    expect(h).not.toMatch(/undefined|NaN|error/i);
  });

  it("029:FR-004: an unset limit shows the round without a fraction", () => {
    expect(stageLabel({ stage: "qa", round: 2, limit: 0 } as never)).toBe("QA round 2");
  });

  it("029:FR-004: review state appears once, in the header, and not as a per-lane column", () => {
    const v = fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2" }], { stage: "qa", round: 1, limit: 3 });
    const out = stripAnsi(renderFleet(caps, { view: v, state: initFleetState(), now: NOW, rows: 24 }));
    expect(out.match(/QA round/g)).toHaveLength(1);
    expect(out).not.toMatch(/REVIEW/);
  });

  it("029:FR-001: other unfinished runs are summarised as '+N more runs' (singular for one)", () => {
    expect(header({}, ["a.2", "b.3"])).toContain("+2 more runs");
    expect(header({}, ["a.2"])).toContain("+1 more run");
    expect(header({}, ["a.2"])).not.toContain("+1 more runs");
  });

  it("029:FR-004: the compact header keeps NEEDS A DECISION, and plain keeps the words without a frame", () => {
    const v = fleetView([{}], { stage: "qa", round: 1, limit: 3, needsDecision: true });
    const compact = stripAnsi(renderFleet(fakeCapabilities({ columns: 50 }), { view: v, state: initFleetState(), now: NOW, rows: 24 })).split("\n")[0]!;
    expect(compact).toContain("NEEDS A DECISION");
    expect([...compact].length).toBeLessThanOrEqual(50);
    expect(headerText(fakeCapabilities({ isTTY: false, unicode: false }), v, "plain")).toContain("NEEDS A DECISION");
  });
});

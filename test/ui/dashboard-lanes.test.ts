import { describe, expect, it } from "vitest";
import type { FeatureRow, LaneView } from "../../src/core/overview-types.js";
import { plainWorktrees, worktreesPanel } from "../../src/cli/ui/dashboard/worktrees-panel.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

/** Lane sub-rows in the WORKTREES & AGENTS panel (feature 015, US-4, FR-012). */

const wtCheckout = { root: "/r/.worktrees/015-x", kind: "worktree" as const, branch: "015-x", dirty: false, stale: false };
const lane = (index: number, done: number, state: LaneView["state"], drift: string[] = []): LaneView => ({
  name: `015-x.lane-3-${index}`,
  phase: 3,
  index,
  done,
  total: 3,
  state,
  drift,
});
const base: FeatureRow = { ref: "015", name: "015-x", tasks: { done: 2, total: 6 }, percent: 33, phase: "implementing", clarifications: 0, checkout: wtCheckout };
const withLanes: FeatureRow = { ...base, lanes: [lane(1, 2, "dirty"), lane(2, 0, "clean", ["T042"])] };

const wide = fakeCapabilities({ color: false, columns: 120 });
const ascii = fakeCapabilities({ color: false, unicode: false, columns: 120 });

describe("lane sub-rows", () => {
  it("renders an indented row per lane under its feature (unicode)", () => {
    const out = worktreesPanel(wide, [withLanes], undefined, 100).map(stripAnsi);
    const i = out.findIndex((l) => l.includes("015"));
    expect(out[i + 1]).toContain("↳ lane 3-1 · 2/3 · dirty");
    expect(out[i + 2]).toContain("↳ lane 3-2 · 0/3 · clean · drift T042");
  });

  it("uses ASCII separators without unicode", () => {
    const out = worktreesPanel(ascii, [withLanes], undefined, 100).map(stripAnsi).join("\n");
    expect(out).toContain("> lane 3-1 - 2/3 - dirty");
    expect(out).not.toContain("↳");
  });

  it("fits a narrow panel and keeps the cursor on the feature row", () => {
    const out = worktreesPanel(wide, [withLanes, { ...base, name: "016-y", ref: "016" }], undefined, 70, { narrow: true, cursor: 1, focused: true }).map(stripAnsi);
    const cursorLine = out.find((l) => l.includes("▸") || l.includes(">"));
    expect(cursorLine).toContain("016");
  });

  it("plain layout adds a `lane 3-1  2/3  dirty` line", () => {
    const lines = plainWorktrees(wide, [withLanes], undefined);
    expect(lines).toContain("    lane 3-1  2/3  dirty");
    expect(lines).toContain("    lane 3-2  0/3  clean  drift T042");
  });

  it("is byte-identical to today without lanes", () => {
    const noLanes = worktreesPanel(wide, [base], undefined, 100);
    const emptyLanes = worktreesPanel(wide, [{ ...base, lanes: [] }], undefined, 100);
    expect(emptyLanes).toEqual(noLanes);
    expect(plainWorktrees(wide, [{ ...base, lanes: [] }], undefined)).toEqual(plainWorktrees(wide, [base], undefined));
  });

  it("a feature with lanes but no worktree still appears", () => {
    const row = { ...withLanes };
    delete row.checkout;
    expect(plainWorktrees(wide, [row], undefined).join("\n")).toContain("lane 3-1");
  });
});

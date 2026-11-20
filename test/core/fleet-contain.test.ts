import { describe, expect, it } from "vitest";
import { affectedBy, heldFeatures } from "../../src/core/fleet-plan/contain.js";
import type { FleetFeature, FleetFeatureState } from "../../src/core/fleet-plan/types.js";

const f = (feature: string, state: FleetFeatureState, ...on: string[]): FleetFeature => ({
  feature,
  state,
  waitsFor: on.map((x) => ({ feature: x, why: "depends-on" as const })),
  ownership: { files: [], unknown: [] },
  fingerprint: "x",
});

const FLEET = [f("a", "running"), f("b", "waiting", "a"), f("c", "waiting", "b"), f("d", "running"), f("e", "done", "a")];

describe("fleet containment (feature 031)", () => {
  it("031:FR-009: a paused feature holds its dependents, directly and through a chain", () => {
    const held = heldFeatures(FLEET, new Set(["a"]));
    expect([...held.entries()]).toEqual([["b", "a"], ["c", "a"]]);
  });

  it("031:FR-009: independent features and done features are never held", () => {
    const held = heldFeatures(FLEET, new Set(["a"]));
    expect(held.has("d")).toBe(false);
    expect(held.has("e")).toBe(false);
  });

  it("031:FR-009: nothing paused means nothing held, so resuming releases the dependents", () => {
    expect(heldFeatures(FLEET, new Set(["a"])).size).toBe(2);
    expect(heldFeatures(FLEET, new Set()).size).toBe(0);
  });

  it("031:FR-009: the affected list names the paused feature and what it holds", () => {
    expect(affectedBy(FLEET, "a")).toEqual(["a", "b", "c"]);
  });
});

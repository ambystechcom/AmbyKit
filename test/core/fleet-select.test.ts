import { describe, expect, it } from "vitest";
import { notReadyReason, selectFeatures } from "../../src/core/fleet-plan/select.js";
import { model } from "../helpers/fleet-plan-fixture.js";

const READY = [model({ dir: "030-a" }), model({ dir: "031-b" }), model({ dir: "032-c", status: "draft" }), model({ dir: "033-d", plan: false })];

describe("fleet selection (feature 031)", () => {
  it("031:FR-001: named features resolve by number or directory name, in the order given", () => {
    const r = selectFeatures(["031", "030-a"], READY);
    expect(r.errors).toEqual([]);
    expect(r.selected.map((m) => m.dir)).toEqual(["031-b", "030-a"]);
  });

  it("031:FR-003: a feature listed twice is scheduled once", () => {
    const r = selectFeatures(["030", "030-a", "30"], READY);
    expect(r.selected.map((m) => m.dir)).toEqual(["030-a"]);
  });

  it("031:FR-002: a feature that does not exist stops with its name", () => {
    const r = selectFeatures(["030", "099"], READY);
    expect(r.errors).toEqual([expect.objectContaining({ kind: "not-found", feature: "099" })]);
    expect(r.errors[0]!.message).toContain("099");
  });

  it("031:FR-002: a feature that is not ready stops with the reason", () => {
    const r = selectFeatures(["032", "033"], READY);
    expect(r.errors.map((e) => e.message)).toEqual([
      expect.stringContaining("032-c is not ready to run: spec status is 'draft'"),
      expect.stringContaining("033-d is not ready to run: no plan.md"),
    ]);
  });

  it("031:FR-002: a feature with every task checked off is not ready", () => {
    const done = model({ dir: "034-e", tasks: [{ id: "T001", done: true }] });
    expect(notReadyReason(done)).toBe("every task is already checked off");
  });

  it("031:FR-016: --all-ready picks the ready features and lists the others skipped with reasons", () => {
    const r = selectFeatures([], READY, { allReady: true });
    expect(r.selected.map((m) => m.dir)).toEqual(["030-a", "031-b"]);
    expect(r.skipped).toEqual([
      { feature: "032-c", reason: expect.stringContaining("draft") },
      { feature: "033-d", reason: "no plan.md" },
    ]);
  });

  it("031:FR-016: finished features are not listed as skipped", () => {
    const r = selectFeatures([], [model({ dir: "030-a" }), model({ dir: "029-z", status: "done" })], { allReady: true });
    expect(r.skipped).toEqual([]);
  });

  it("031:FR-016: with no feature ready it says so and selects nothing", () => {
    const r = selectFeatures([], [model({ dir: "032-c", status: "draft" })], { allReady: true });
    expect(r.selected).toEqual([]);
    expect(r.errors).toEqual([expect.objectContaining({ kind: "no-features" })]);
    expect(r.skipped).toHaveLength(1);
  });

  it("031:FR-001: no features given is an error, not an empty fleet", () => {
    expect(selectFeatures([], READY).errors).toEqual([expect.objectContaining({ kind: "no-features" })]);
  });
});

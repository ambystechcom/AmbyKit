import { describe, expect, it } from "vitest";
import { orderFleet } from "../../src/core/fleet-plan/order.js";
import type { DepEdge, Ownership } from "../../src/core/fleet-plan/types.js";

const o = (...files: string[]): Ownership => ({ files, unknown: [] });
const feat = (feature: string, ownership: Ownership) => ({ feature, ownership });
const dep = (feature: string, on: string, why: DepEdge["why"] = "depends-on"): DepEdge => ({ feature, on, why });

function ok(input: Parameters<typeof orderFleet>[0]) {
  const r = orderFleet(input);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

describe("fleet order (feature 031)", () => {
  it("031:FR-007: a chain of dependencies starts in dependency order", () => {
    const v = ok({
      features: [feat("033-c", o("c")), feat("031-a", o("a")), feat("032-b", o("b"))],
      deps: [dep("033-c", "032-b"), dep("032-b", "031-a", "story-edge")],
    });
    expect(v.order).toEqual(["031-a", "032-b", "033-c"]);
    expect(v.waitsFor.get("032-b")).toEqual([{ feature: "031-a", why: "story-edge" }]);
  });

  it("031:FR-004: features sharing a file are serialized, earlier number first, naming the shared files", () => {
    const v = ok({ features: [feat("032-b", o("src/x.ts", "src/b.ts")), feat("031-a", o("src/x.ts"))], deps: [] });
    expect(v.order).toEqual(["031-a", "032-b"]);
    expect(v.waitsFor.get("032-b")).toEqual([{ feature: "031-a", why: "shared-files", files: ["src/x.ts"] }]);
    expect(v.waitsFor.get("031-a")).toEqual([]);
  });

  it("031:FR-004: a later feature that already depends on the earlier one gets no second wait", () => {
    const v = ok({ features: [feat("031-a", o("x")), feat("032-b", o("x"))], deps: [dep("032-b", "031-a")] });
    expect(v.waitsFor.get("032-b")).toEqual([{ feature: "031-a", why: "depends-on" }]);
  });

  it("031:FR-004: independent features with no shared file wait for nothing and may run together", () => {
    const v = ok({ features: [feat("031-a", o("a")), feat("032-b", o("b"))], deps: [] });
    expect(v.waitsFor.get("031-a")).toEqual([]);
    expect(v.waitsFor.get("032-b")).toEqual([]);
  });

  it("031:FR-006: a feature with unknown ownership waits for every earlier feature", () => {
    const v = ok({ features: [feat("031-a", o("a")), feat("032-b", { files: [], unknown: ["T002"] }), feat("033-c", o("c"))], deps: [] });
    expect(v.waitsFor.get("032-b")!.map((w) => w.feature)).toEqual(["031-a"]);
    expect(v.waitsFor.get("033-c")!.map((w) => w.feature)).toEqual(["032-b"]); // conservative against the unknown one
  });

  it("031:FR-004: a declared and a derived edge between the same two features count once", () => {
    const v = ok({ features: [feat("031-a", o("a")), feat("032-b", o("b"))], deps: [dep("032-b", "031-a"), dep("032-b", "031-a", "story-edge")] });
    expect(v.waitsFor.get("032-b")).toHaveLength(1);
  });

  it("031:FR-008: a dependency on a feature outside the fleet and not done stops and names it", () => {
    const r = orderFleet({ features: [feat("032-b", o("b"))], deps: [dep("032-b", "030-base")] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ kind: "missing-dependency", feature: "032-b", on: "030-base" });
  });

  it("031:FR-008: a dependency on a done feature outside the fleet is satisfied", () => {
    const r = orderFleet({ features: [feat("032-b", o("b"))], deps: [dep("032-b", "030-base")], done: new Set(["030-base"]) });
    expect(r.ok).toBe(true);
  });

  it("031:FR-008: a dependency cycle stops and shows the cycle", () => {
    const r = orderFleet({ features: [feat("031-a", o("a")), feat("032-b", o("b"))], deps: [dep("031-a", "032-b"), dep("032-b", "031-a")] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.kind).toBe("cycle");
      expect(r.errors[0]!.message).toContain("031-a");
      expect(r.errors[0]!.message).toContain("032-b");
    }
  });

  it("031:FR-004: equal dependency order and overlapping files are ordered by number", () => {
    const v = ok({ features: [feat("040-z", o("s")), feat("035-y", o("s"))], deps: [] });
    expect(v.order).toEqual(["035-y", "040-z"]);
  });
});

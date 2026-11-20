import { describe, expect, it } from "vitest";
import { planJson, planLines } from "../../src/core/fleet-plan/format.js";
import { buildFleetPlan, fingerprintOf } from "../../src/core/fleet-plan/plan.js";
import type { DepEdge } from "../../src/core/fleet-plan/types.js";
import { model, type FeatureDef } from "../helpers/fleet-plan-fixture.js";

const CAPS = { total: 3, perType: 2 };
const BUDGETS = { wallClockMinutes: 120, maxTasks: 20 };

function plan(defs: FeatureDef[], args: string[], deps: DepEdge[] = [], extra: { done?: string[]; allReady?: boolean } = {}) {
  return buildFleetPlan({
    args,
    ...(extra.allReady ? { allReady: true } : {}),
    models: defs.map(model),
    deps,
    done: new Set(extra.done ?? []),
    caps: CAPS,
    budgets: BUDGETS,
  });
}

const THREE: FeatureDef[] = [
  { dir: "030-base", tasks: [{ id: "T001", paths: ["src/base.ts"] }], lanes: 2 },
  { dir: "031-mid", tasks: [{ id: "T001", paths: ["src/shared.ts"] }], lanes: 0 },
  { dir: "032-top", tasks: [{ id: "T001", paths: ["src/shared.ts"] }, { id: "T002", paths: null }], lanes: 3 },
];
const DEPS: DepEdge[] = [{ feature: "031-mid", on: "030-base", why: "depends-on" }];

describe("fleet plan (feature 031)", () => {
  it("031:FR-001: one plan lists every feature's lanes and the order they start in", () => {
    const r = plan(THREE, ["030", "031", "032"], DEPS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.features.map((f) => f.feature)).toEqual(["030-base", "031-mid", "032-top"]);
    expect(r.value.laneCounts).toEqual({ "030-base": 2, "031-mid": 0, "032-top": 3 });
    expect(r.value.prepare).toEqual([{ feature: "031-mid", lanes: 2 }]);
    expect(r.value.caps).toEqual(CAPS);
  });

  it("031:FR-005: the preview names the shared files behind each serialization and the dependency", () => {
    const r = plan(THREE, ["030", "031", "032"], DEPS);
    if (!r.ok) throw new Error("x");
    const text = planLines(r.value).join("\n");
    expect(text).toContain("031-mid — 2 lanes to prepare — waits for 030-base (depends-on)");
    expect(text).toContain("shared files: src/shared.ts");
    expect(text).toContain("3 assistants at once, 2 of one type");
  });

  it("031:FR-006: the preview flags a task with no ownership by id", () => {
    const r = plan(THREE, ["030", "031", "032"], DEPS);
    if (!r.ok) throw new Error("x");
    expect(planLines(r.value).join("\n")).toContain("unknown ownership: T002");
  });

  it("031:FR-002: a missing or not-ready feature makes the whole plan fail before anything starts", () => {
    const r = plan(THREE, ["030", "099"], DEPS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ kind: "not-found", feature: "099" });
  });

  it("031:FR-008: a dependency on an unselected feature that is not done stops the plan; done is fine", () => {
    const missing = plan(THREE, ["031"], DEPS);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors[0]).toMatchObject({ kind: "missing-dependency", on: "030-base" });
    expect(plan(THREE, ["031"], DEPS, { done: ["030-base"] }).ok).toBe(true);
  });

  it("031:FR-008: a dependency cycle stops the plan and shows the cycle", () => {
    const r = plan(THREE, ["030", "031"], [...DEPS, { feature: "030-base", on: "031-mid", why: "story-edge" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.kind).toBe("cycle");
  });

  it("031:FR-016: --all-ready plans every ready feature and reports the skipped ones in the preview", () => {
    const r = plan([...THREE, { dir: "033-draft", status: "draft" }], [], DEPS, { allReady: true });
    if (!r.ok) throw new Error("x");
    expect(r.value.features).toHaveLength(3);
    expect(r.value.skipped).toEqual([{ feature: "033-draft", reason: expect.stringContaining("draft") }]);
    expect(planLines(r.value).join("\n")).toContain("033-draft — spec status is 'draft'");
  });

  it("031:FR-001: the --json preview carries order, waits, ownership and skipped", () => {
    const r = plan(THREE, ["030", "031", "032"], DEPS);
    if (!r.ok) throw new Error("x");
    const j = planJson(r.value) as { features: { feature: string; waitsFor: unknown[]; prepare: number }[] };
    expect(j.features.map((f) => f.feature)).toEqual(["030-base", "031-mid", "032-top"]);
    expect(j.features[1]!.prepare).toBe(2);
    expect(j.features[1]!.waitsFor).toEqual([{ feature: "030-base", why: "depends-on" }]);
  });

  it("031:FR-018: the fingerprint changes when tasks or dependencies change, not when a task is ticked", () => {
    const a = model({ dir: "030-a", tasks: [{ id: "T001", paths: ["src/a.ts"] }] });
    const ticked = model({ dir: "030-a", tasks: [{ id: "T001", paths: ["src/a.ts"], done: true }] });
    const edited = model({ dir: "030-a", tasks: [{ id: "T001", paths: ["src/b.ts"] }] });
    expect(fingerprintOf(ticked, [])).toBe(fingerprintOf(a, []));
    expect(fingerprintOf(edited, [])).not.toBe(fingerprintOf(a, []));
    expect(fingerprintOf(a, [{ feature: "030-a", on: "029-x", why: "depends-on" }])).not.toBe(fingerprintOf(a, []));
  });
});

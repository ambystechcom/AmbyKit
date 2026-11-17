import { describe, expect, it } from "vitest";
import { buildMatrix } from "../../src/core/trace.js";
import type { TestEntry, TraceFeature } from "../../src/core/trace-types.js";

const feat = (dir: string, ids: string[], deliberate: Record<string, string> = {}): TraceFeature => ({
  dir,
  ref: dir.slice(0, 3),
  requirements: ids.map((id) => ({ id, text: `text ${id}` })),
  deliberate: new Map(Object.entries(deliberate)),
});
const t = (title: string, skipped = false, file = "a.test.ts"): TestEntry => ({ file, line: 1, title, skipped });

describe("trace matrix", () => {
  const features = [feat("019-a", ["FR-001", "FR-002", "FR-003"], { "FR-003": "manual" }), feat("020-b", ["FR-001"])];

  it("024:FR-001: maps requirements to the tests that cite them", () => {
    const r = buildMatrix({ features, tests: [t("019:FR-001: x")] });
    const a = r.features[0]!;
    expect(a.requirements[0]).toMatchObject({ id: "FR-001", qid: "019:FR-001", status: "covered" });
    expect(a.requirements[0]!.tests).toHaveLength(1);
    expect(a.coverage).toEqual({ covered: 1, total: 3, uncovered: 1, deliberate: 1 });
  });

  it("024:FR-003: lists an uncited requirement as uncovered with id and text", () => {
    const r = buildMatrix({ features, tests: [] });
    expect(r.features[0]!.requirements[1]).toMatchObject({ id: "FR-002", text: "text FR-002", status: "uncovered" });
  });

  it("024:FR-010: a deliberate requirement is not uncovered and carries its reason", () => {
    const r = buildMatrix({ features, tests: [] });
    expect(r.features[0]!.requirements[2]).toMatchObject({ status: "deliberate", reason: "manual" });
  });

  it("024:FR-002: one test citing several ids covers each", () => {
    const r = buildMatrix({ features, tests: [t("019:FR-001, 020:FR-001: both")] });
    expect(r.features.map((f) => f.coverage.covered)).toEqual([1, 1]);
  });

  it("024:FR-004: a test citing an unknown id is an orphan, not uncited", () => {
    const r = buildMatrix({ features, tests: [t("019:FR-099: gone"), t("999:FR-001: nowhere")] });
    expect(r.orphans.map((o) => o.cites)).toEqual([["019:FR-099"], ["999:FR-001"]]);
    expect(r.uncited).toHaveLength(0);
  });

  it("024:FR-005: a test citing nothing is uncited, separate from orphans", () => {
    const r = buildMatrix({ features, tests: [t("does a thing (FR-001)")] });
    expect(r.uncited).toMatchObject([{ reason: "no-id" }]);
    expect(r.orphans).toHaveLength(0);
  });

  it("024:FR-007: a bare id defined by two features is ambiguous and matches none", () => {
    const r = buildMatrix({ features, tests: [t("FR-001: bare")] });
    expect(r.ambiguous).toMatchObject([{ id: "FR-001", features: ["019", "020"] }]);
    expect(r.features.every((f) => f.coverage.covered === 0)).toBe(true);
  });

  it("024:FR-007: a bare id defined by one feature is unqualified, still not matched", () => {
    const r = buildMatrix({ features, tests: [t("FR-002: bare")] });
    expect(r.uncited).toMatchObject([{ reason: "unqualified" }]);
    expect(r.features[0]!.coverage.covered).toBe(0);
  });

  it("024:FR-003: a skipped test never covers and is listed separately", () => {
    const r = buildMatrix({ features, tests: [t("019:FR-002: later", true)] });
    expect(r.features[0]!.requirements[1]!.status).toBe("uncovered");
    expect(r.skipped).toMatchObject([{ cites: ["019:FR-002"] }]);
  });

  it("024:FR-006: one feature argument limits the report", () => {
    const r = buildMatrix({ features, tests: [t("020:FR-001: x"), t("plain")], only: "019" });
    expect(r.features.map((f) => f.ref)).toEqual(["019"]);
    expect(r.uncited).toHaveLength(0);
  });

  it("024:FR-017: designed cases are matched, missing or manual", () => {
    const designs = new Map([
      ["019-a", { cases: [
        { id: "TC-001", fr: ["FR-001"], kind: "auto" as const },
        { id: "TC-002", fr: ["FR-002"], kind: "auto" as const },
        { id: "TC-003", fr: ["FR-002"], kind: "manual" as const },
      ] }],
    ]);
    const r = buildMatrix({ features, tests: [t("019:FR-001: x")], designs });
    expect(r.features[0]!.design!.cases.map((c) => c.state)).toEqual(["matched", "missing", "manual"]);
  });

  it("024:FR-018: no design means no design block", () => {
    expect(buildMatrix({ features, tests: [] }).features[0]!.design).toBeUndefined();
  });

  it("024:FR-001: a feature with no requirements reports none and nothing uncovered", () => {
    const r = buildMatrix({ features: [feat("021-c", [])], tests: [] });
    expect(r.features[0]).toMatchObject({ hasRequirements: false, coverage: { total: 0, uncovered: 0 } });
  });
});

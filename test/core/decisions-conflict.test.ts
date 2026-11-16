import { describe, expect, it } from "vitest";
import { analyzeDecisions, type DecisionRecord } from "../../src/core/decisions.js";

const r = (status: DecisionRecord["status"], conflicts: string[]): DecisionRecord => ({ id: "ADR-001", title: "t", status, conflicts, file: "ADR-001.md" });
const run = (rec: DecisionRecord) => analyzeDecisions({ records: [rec], invalid: [], indexIds: ["ADR-001"], citations: [] });

describe("accepted-with-conflict (022 FR-013, US-5)", () => {
  it("is an error when an accepted record lists a conflicting principle", () => {
    expect(run(r("accepted", ["3"]))).toEqual([expect.objectContaining({ kind: "accepted-with-conflict", level: "error", ids: ["ADR-001"] })]);
  });
  it("allows a proposed record with conflicts, and an accepted one without", () => {
    expect(run(r("proposed", ["3"]))).toEqual([]);
    expect(run(r("accepted", []))).toEqual([]);
  });
});

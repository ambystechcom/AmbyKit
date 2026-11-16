import { describe, expect, it } from "vitest";
import { analyzeDecisions, type DecisionRecord, type DecisionsInput } from "../../src/core/decisions.js";

const r = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id,
  title: id,
  status: "accepted",
  conflicts: [],
  file: `${id}.md`,
  ...extra,
});
const input = (records: DecisionRecord[], extra: Partial<DecisionsInput> = {}): DecisionsInput => ({
  records,
  invalid: [],
  indexIds: records.map((x) => x.id),
  citations: [],
  ...extra,
});
const kinds = (i: DecisionsInput) => analyzeDecisions(i).map((x) => x.kind);

describe("analyzeDecisions (022)", () => {
  it("is clean for consistent records", () => expect(analyzeDecisions(input([r("ADR-001"), r("ADR-002")]))).toEqual([]));

  it("duplicate-id: two records share an id, or id differs from the file name", () => {
    expect(kinds(input([r("ADR-001"), r("ADR-001", { file: "ADR-001-copy.md" })]))).toContain("duplicate-id");
    expect(kinds(input([r("ADR-002", { file: "ADR-001.md" })]))).toContain("duplicate-id");
  });

  it("dangling-citation: an error naming the source and id (FR-007, SC-002)", () => {
    const issues = analyzeDecisions(
      input([r("ADR-001")], { citations: [{ id: "ADR-001", source: "a.md" }, { id: "ADR-009", source: "specs/001/plan.md" }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "dangling-citation", level: "error", ids: ["ADR-009"] });
    expect(issues[0]!.message).toContain("specs/001/plan.md");
  });

  it("index-drift: a warning when a record has no index row; none without records", () => {
    const issues = analyzeDecisions(input([r("ADR-001"), r("ADR-002")], { indexIds: ["ADR-001"] }));
    expect(issues).toEqual([expect.objectContaining({ kind: "index-drift", level: "warning", ids: ["ADR-002"] })]);
    expect(analyzeDecisions(input([], { indexIds: null }))).toEqual([]);
    expect(kinds(input([r("ADR-001")], { indexIds: null }))).toEqual(["index-drift"]);
  });

  it("invalid records are errors", () => {
    expect(kinds(input([], { invalid: [{ file: "x.md", message: "bad" }] }))).toEqual(["invalid-record"]);
  });
});

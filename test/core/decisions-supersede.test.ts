import { describe, expect, it } from "vitest";
import { analyzeDecisions, currentOf, type DecisionRecord } from "../../src/core/decisions.js";

const r = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord => ({ id, title: id, status: "accepted", conflicts: [], file: `${id}.md`, ...extra });
const run = (records: DecisionRecord[]) => analyzeDecisions({ records, invalid: [], indexIds: records.map((x) => x.id), citations: [] });

const chain = [
  r("ADR-001", { status: "superseded", supersededBy: "ADR-002" }),
  r("ADR-002", { status: "superseded", supersedes: "ADR-001", supersededBy: "ADR-003" }),
  r("ADR-003", { supersedes: "ADR-002" }),
];

describe("currentOf (022 FR-010, SC-003)", () => {
  it("follows superseded-by to the live record", () => {
    expect(currentOf(chain, "ADR-001")?.id).toBe("ADR-003");
    expect(currentOf(chain, "ADR-003")?.id).toBe("ADR-003");
  });
  it("is undefined for an unknown id or a loop", () => {
    expect(currentOf(chain, "ADR-099")).toBeUndefined();
    const loop = [r("ADR-001", { status: "superseded", supersededBy: "ADR-002" }), r("ADR-002", { status: "superseded", supersededBy: "ADR-001" })];
    expect(currentOf(loop, "ADR-001")).toBeUndefined();
  });
});

describe("supersede checks (022)", () => {
  it("a consistent chain is clean", () => expect(run(chain)).toEqual([]));

  it("supersede-mismatch: new supersedes old but old is not marked", () => {
    expect(run([r("ADR-001"), r("ADR-002", { supersedes: "ADR-001" })]).map((i) => i.kind)).toEqual(["supersede-mismatch"]);
  });

  it("supersede-mismatch: old points at new but new does not list it, and status mismatches", () => {
    expect(run([r("ADR-001", { status: "superseded", supersededBy: "ADR-002" }), r("ADR-002")]).map((i) => i.kind)).toEqual(["supersede-mismatch"]);
    const wrongStatus = run([r("ADR-001", { supersededBy: "ADR-002" }), r("ADR-002", { supersedes: "ADR-001" })]);
    expect(wrongStatus.length).toBeGreaterThan(0);
    expect(wrongStatus.every((i) => i.kind === "supersede-mismatch")).toBe(true);
    expect(run([r("ADR-001", { status: "superseded" })]).map((i) => i.kind)).toEqual(["supersede-mismatch"]);
  });

  it("supersede-cycle: reported once", () => {
    const loop = [
      r("ADR-001", { status: "superseded", supersedes: "ADR-002", supersededBy: "ADR-002" }),
      r("ADR-002", { status: "superseded", supersedes: "ADR-001", supersededBy: "ADR-001" }),
    ];
    const cycles = run(loop).filter((i) => i.kind === "supersede-cycle");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.level).toBe("error");
  });
});

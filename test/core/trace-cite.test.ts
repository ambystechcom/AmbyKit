import { describe, expect, it } from "vitest";
import { parseCitation } from "../../src/core/trace-cite.js";

describe("trace citation prefix", () => {
  it("024:FR-002: reads a qualified id at the start of a title", () => {
    expect(parseCitation("019:FR-004: does x").qualified).toEqual([{ ref: "019", id: "FR-004", qid: "019:FR-004" }]);
  });

  it("024:FR-002: reads several ids, comma or space separated", () => {
    expect(parseCitation("019:FR-004, 020:FR-001 019:FR-005: both").qualified.map((q) => q.qid)).toEqual([
      "019:FR-004",
      "020:FR-001",
      "019:FR-005",
    ]);
  });

  it("024:FR-007: a bare id is kept apart from qualified ones", () => {
    const c = parseCitation("FR-004: bare");
    expect(c.qualified).toEqual([]);
    expect(c.bare).toEqual(["FR-004"]);
  });

  it("024:FR-002: an id anywhere but the prefix does not cite", () => {
    const c = parseCitation("does x (FR-001) and 019:FR-002");
    expect(c.qualified).toEqual([]);
    expect(c.bare).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findClarifications } from "../../src/core/clarifications.js";

describe("findClarifications (R-1, FR-010)", () => {
  it("captures bare markers with line and text", () => {
    const md = ["# Spec", "", "- FR-001 SHALL x. [NEEDS CLARIFICATION: which transport?]"].join("\n");
    expect(findClarifications(md)).toEqual([{ line: 3, text: "which transport?" }]);
  });

  it("finds several markers on one line", () => {
    const md = "a [NEEDS CLARIFICATION: one] b [NEEDS CLARIFICATION: two]";
    expect(findClarifications(md).map((c) => c.text)).toEqual(["one", "two"]);
  });

  it("ignores markers inside inline code and fenced blocks", () => {
    const md = [
      "> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.",
      "```",
      "[NEEDS CLARIFICATION: in a fence]",
      "```",
      "count ``[NEEDS CLARIFICATION`` markers",
    ].join("\n");
    expect(findClarifications(md)).toEqual([]);
  });

  it("this repo's 014 spec has no open clarifications", () => {
    const spec = readFileSync("specs/014-enhanced-dashboard/spec.md", "utf8");
    expect(findClarifications(spec)).toEqual([]);
  });
});

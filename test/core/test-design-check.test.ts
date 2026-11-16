import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_CASES_PER_STORY, checkTestDesign, parseTestDesign } from "../../src/core/index.js";

/**
 * The checker against a real spec: this feature's own `spec.md` and hand-written `tests.md` are the
 * fixture. Each test mutates the design text (never the files) and checks what the checker reports.
 */
const root = join(import.meta.dirname, "..", "..", "specs", "021-test-design");
const spec = readFileSync(join(root, "spec.md"), "utf8");
const design = readFileSync(join(root, "tests.md"), "utf8");

const check = (text: string) => checkTestDesign(spec, parseTestDesign(text));
/** The design with FR-017 left out of its only case, so exactly that requirement has no case. */
const withoutFr017 = design.replace("[FR-016, FR-017]", "[FR-016]");

describe("checkTestDesign against a real spec (spec 021, US-3)", () => {
  it("021:FR-007: the unchanged design has no findings (every FR and criterion covered)", () => {
    expect(check(design)).toEqual([]);
  });

  it("021:FR-007: removing every case that cites an FR reports that FR as uncovered", () => {
    const found = check(withoutFr017).filter((f) => f.kind === "uncovered-fr");
    expect(found.map((f) => f.ref)).toEqual(["FR-017"]);
  });

  it("021:FR-007: marking that FR deliberately uncovered with a reason silences it, in either form", () => {
    const base = withoutFr017;
    expect(check(base).some((f) => f.kind === "uncovered-fr")).toBe(true);
    for (const form of ["- FR-017: deliberately uncovered — documentation only", "uncovered: FR-017 — documentation only"]) {
      expect(check(`${base}\n${form}`).some((f) => f.kind === "uncovered-fr")).toBe(false);
    }
  });

  it("021:FR-007: a deliberately-uncovered entry with no reason does not count", () => {
    const base = withoutFr017;
    expect(check(`${base}\nuncovered: FR-017 — `).some((f) => f.kind === "uncovered-fr")).toBe(true);
  });

  it("021:FR-008: a case citing an unknown requirement or criterion is reported with its line", () => {
    const text = `${design}\n- [TC-026] [US-1#1] [FR-099] auto — extra → nothing\n- [TC-027] [US-8#1] [FR-001] auto — extra → nothing`;
    const unknown = check(text).filter((f) => f.kind === "unknown-id");
    expect(unknown.map((f) => f.ref).sort()).toEqual(["FR-099", "US-8#1"]);
    expect(unknown.every((f) => (f.line ?? 0) > 0)).toBe(true);
  });

  it("021:FR-008: an unknown requirement in the uncovered list or an unknown criterion in a flag is reported", () => {
    const text = `${design}\nuncovered: FR-098 — nope\n## Flags\n- US-1#42: too vague to test — nope`;
    const refs = check(text)
      .filter((f) => f.kind === "unknown-id")
      .map((f) => f.ref);
    expect(refs.sort()).toEqual(["FR-098", "US-1#42"]);
  });

  it("021:FR-004: more than 15 cases for one story reports that story, and 15 is still fine", () => {
    const fill = (n: number) =>
      Array.from({ length: n }, (_, i) => `- [TC-${100 + i}] [US-5#1] [FR-014] auto — filler ${i} → ok`).join("\n");
    // US-5 already has 3 cases in the design: 12 more make exactly 15, 13 more make 16.
    expect(check(`${design}\n${fill(12)}`).some((f) => f.kind === "too-many-cases")).toBe(false);
    const over = check(`${design}\n${fill(MAX_CASES_PER_STORY - 2)}`).filter((f) => f.kind === "too-many-cases");
    expect(over.map((f) => f.ref)).toEqual(["US-5"]);
    expect(over[0]?.message).toContain("16 cases");
  });

  it("021:FR-003: a criterion with no case is reported until it is flagged as too vague", () => {
    // TC-002 is the only case for US-1#2; point it at US-1#1 so FR-003 stays covered and only the criterion is bare.
    const text = design.replace("[US-1#2] [FR-003]", "[US-1#1] [FR-003]");
    expect(check(text).filter((f) => f.kind === "uncovered-criterion").map((f) => f.ref)).toEqual(["US-1#2"]);
    expect(check(`${text}\n## Flags\n- US-1#2: too vague to test — no observable outcome`)).toEqual([]);
  });

  it("021:FR-009: a duplicated case id is reported", () => {
    const text = `${design}\n- [TC-001] [US-1#1] [FR-001] auto — again → twice`;
    expect(check(text).filter((f) => f.kind === "duplicate-case").map((f) => f.ref)).toEqual(["TC-001"]);
  });

  it("021:FR-016: a skip form is valid for any spec and reports nothing", () => {
    expect(check("skipped: documentation fix, nothing to test\n")).toEqual([]);
  });
});

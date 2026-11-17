import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_CASES_PER_STORY,
  checkTestDesign,
  extractSpecIds,
  nextCaseId,
  parseTestDesign,
} from "../../src/core/index.js";

const SPEC = [
  "---",
  "status: ready",
  "---",
  "## User scenarios",
  "### US-1 — First  (priority: P1)",
  "**Acceptance criteria**",
  "- Given a, When b, Then c.",
  "- Given d, When e, Then f.",
  "### US-2 — Second  (priority: P2)",
  "**Acceptance criteria**",
  "- Given g, When h, Then i.",
  "## Requirements (EARS)",
  "- FR-001  THE SYSTEM SHALL do one.",
  "- FR-002  THE SYSTEM SHALL do two.",
  "- FR-003  THE SYSTEM SHALL do three.",
].join("\n");

const GOOD = [
  "---",
  "feature: 099-x",
  "---",
  "## Cases",
  "- [TC-001] [US-1#1] [FR-001] auto — first → one",
  "- [TC-002] [US-1#2] [FR-002] manual:visual-check — second → two; verify: look at it; record: the notes",
  "- [TC-003] [US-2#1] [FR-001, FR-002] auto — third → three",
  "## Uncovered",
  "- FR-003: deliberately uncovered — documentation only",
].join("\n");

const kinds = (design: ReturnType<typeof parseTestDesign>) => checkTestDesign(SPEC, design).map((f) => f.kind);

describe("parseTestDesign", () => {
  it("021:FR-004: reads id, criteria, requirements, decision, name and expected outcome", () => {
    const d = parseTestDesign(GOOD);
    expect(d.cases).toHaveLength(3);
    expect(d.cases[0]).toMatchObject({
      id: "TC-001",
      criteria: ["US-1#1"],
      frs: ["FR-001"],
      decision: { kind: "auto" },
      name: "first",
      expected: "one",
      stale: false,
      obsolete: false,
    });
    expect(d.cases[2]?.frs).toEqual(["FR-001", "FR-002"]);
    expect(d.issues).toHaveLength(0);
  });

  it("021:FR-005: a manual case carries its reason, how it is verified and where the result goes", () => {
    const manual = parseTestDesign(GOOD).cases[1];
    expect(manual?.decision).toEqual({
      kind: "manual",
      reason: "visual-check",
      verify: "look at it",
      record: "the notes",
    });
    expect(manual?.name).toBe("second");
    expect(manual?.expected).toBe("two");
  });

  it("021:FR-007: both spellings of 'deliberately uncovered' parse identically", () => {
    const section = parseTestDesign("## Uncovered\n- FR-003: deliberately uncovered — docs only");
    const line = parseTestDesign("## Uncovered\nuncovered: FR-003 — docs only");
    const bullet = parseTestDesign("- uncovered: FR-003 — docs only");
    for (const d of [section, line, bullet]) {
      expect(d.uncovered.map(({ fr, reason }) => ({ fr, reason }))).toEqual([{ fr: "FR-003", reason: "docs only" }]);
    }
  });

  it("021:FR-016: a file whose only content line is `skipped: <reason>` is a skip", () => {
    const d = parseTestDesign("---\nfeature: 099-x\n---\n# Tests\n\n> note\nskipped: tiny doc fix\n");
    expect(d.skipped).toBe("tiny doc fix");
    expect(d.cases).toHaveLength(0);
    expect(checkTestDesign(SPEC, d)).toEqual([]);
  });

  it("021:FR-016: `skipped:` mixed with other content is reported, not trusted", () => {
    const d = parseTestDesign("## Cases\n- [TC-001] [US-1#1] [FR-001] auto — a → b\nskipped: nope");
    expect(d.skipped).toBeUndefined();
    expect(d.issues.map((i) => i.message).join(" ")).toContain("only content line");
  });

  it("021:FR-013: [stale] and [obsolete] suffixes are read and do not leak into the expected outcome", () => {
    const d = parseTestDesign(
      "- [TC-001] [US-1#1] [FR-001] auto — a → b [stale]\n- [TC-002] [US-9#1] [FR-001] auto — c → d [obsolete]",
    );
    expect(d.cases[0]).toMatchObject({ stale: true, obsolete: false, expected: "b" });
    expect(d.cases[1]).toMatchObject({ stale: false, obsolete: true, expected: "d" });
  });

  it("021:FR-004: accepts CRLF and ASCII dashes, and collects malformed case lines as issues", () => {
    const d = parseTestDesign("## Cases\r\n- [TC-001] [US-1#1] [FR-001] auto - a -> b\r\n- not a case line\r\n");
    expect(d.cases).toHaveLength(1);
    expect(d.issues).toHaveLength(1);
    expect(d.cases[0]).toMatchObject({ name: "a", expected: "b" });
  });

  it("021:FR-009: the next case id is the highest plus one, obsolete cases included", () => {
    const d = parseTestDesign(GOOD + "\n- [TC-007] [US-2#1] [FR-001] auto — x → y [obsolete]");
    expect(nextCaseId(d)).toBe("TC-008");
    expect(nextCaseId(parseTestDesign(""))).toBe("TC-001");
  });
});

describe("checkTestDesign", () => {
  it("021:FR-007: a fully designed feature has no findings", () => {
    expect(checkTestDesign(SPEC, parseTestDesign(GOOD))).toEqual([]);
  });

  it("021:FR-008: an unknown criterion or requirement is reported with the line", () => {
    const d = parseTestDesign(GOOD + "\n- [TC-004] [US-9#1] [FR-099] auto — x → y\n- [TC-005] [US-1#7] [FR-001] auto — x → y");
    const unknown = checkTestDesign(SPEC, d).filter((f) => f.kind === "unknown-id");
    expect(unknown.map((f) => f.ref).sort()).toEqual(["FR-099", "US-1#7", "US-9#1"]);
    expect(unknown.every((f) => typeof f.line === "number")).toBe(true);
  });

  it("021:FR-009: a duplicate case id is reported", () => {
    const d = parseTestDesign(GOOD + "\n- [TC-001] [US-1#1] [FR-001] auto — again → twice");
    expect(kinds(d)).toContain("duplicate-case");
  });

  it("021:FR-006: a manual reason outside the fixed list, or none, is a bad decision", () => {
    const outside = parseTestDesign(GOOD.replace("visual-check", "gut-feeling"));
    const none = parseTestDesign(GOOD.replace("manual:visual-check", "manual"));
    expect(kinds(outside)).toContain("bad-decision");
    expect(kinds(none)).toContain("bad-decision");
  });

  it("021:FR-005: a manual case without verify or record is reported", () => {
    const d = parseTestDesign(GOOD.replace("; verify: look at it; record: the notes", ""));
    expect(kinds(d)).toContain("missing-verify");
  });

  it("021:FR-007: an FR with no case is reported unless deliberately uncovered with a reason", () => {
    const without = GOOD.replace("## Uncovered\n- FR-003: deliberately uncovered — documentation only", "");
    expect(checkTestDesign(SPEC, parseTestDesign(without)).filter((f) => f.kind === "uncovered-fr").map((f) => f.ref)).toEqual(["FR-003"]);
    const oneLine = without + "\nuncovered: FR-003 — documentation only";
    expect(kinds(parseTestDesign(oneLine))).not.toContain("uncovered-fr");
  });

  it("021:FR-003: a flagged criterion needs no case; an unflagged one without a case is reported", () => {
    const missing = GOOD.replace("- [TC-002] [US-1#2] [FR-002] manual:visual-check — second → two; verify: look at it; record: the notes\n", "");
    expect(checkTestDesign(SPEC, parseTestDesign(missing)).filter((f) => f.kind === "uncovered-criterion").map((f) => f.ref)).toEqual(["US-1#2"]);
    const flagged = missing.replace("- [TC-003]", "- [TC-003]") + "\n## Flags\n- US-1#2: too vague to test — no observable outcome";
    expect(kinds(parseTestDesign(flagged))).not.toContain("uncovered-criterion");
  });

  it("021:FR-004: more than 15 cases for one story yields a too-many-cases finding", () => {
    const many = Array.from({ length: MAX_CASES_PER_STORY + 1 }, (_, i) => `- [TC-${String(i + 1).padStart(3, "0")}] [US-1#1] [FR-001] auto — c${i} → ok`).join("\n");
    const d = parseTestDesign(`## Cases\n${many}`);
    expect(checkTestDesign(SPEC, d).filter((f) => f.kind === "too-many-cases").map((f) => f.ref)).toEqual(["US-1"]);
  });

  it("021:FR-013: a stale case is flagged; an obsolete case is kept and not reported as unknown", () => {
    const d = parseTestDesign(GOOD + "\n- [TC-004] [US-1#1] [FR-001] auto — old → gone [stale]\n- [TC-005] [US-1#9] [FR-001] auto — removed → gone [obsolete]");
    const found = checkTestDesign(SPEC, d);
    expect(found.filter((f) => f.kind === "stale-case").map((f) => f.ref)).toEqual(["TC-004"]);
    expect(found.some((f) => f.kind === "unknown-id")).toBe(false);
  });
});

describe("extractSpecIds", () => {
  it("021:FR-008: counts acceptance bullets per story and lists the FRs", () => {
    const ids = extractSpecIds(SPEC);
    expect(ids.status).toBe("ready");
    expect([...ids.criteria]).toEqual([[1, 2], [2, 1]]);
    expect(ids.frs).toEqual(["FR-001", "FR-002", "FR-003"]);
  });
});

describe("this feature's own test design (dogfood)", () => {
  it("021:FR-007: specs/021-test-design/tests.md covers every criterion and requirement of its spec", () => {
    const root = join(__dirname, "..", "..", "specs", "021-test-design");
    const spec = readFileSync(join(root, "spec.md"), "utf8");
    const design = parseTestDesign(readFileSync(join(root, "tests.md"), "utf8"));
    expect(design.cases).toHaveLength(25);
    expect(checkTestDesign(spec, design)).toEqual([]);
  });
});

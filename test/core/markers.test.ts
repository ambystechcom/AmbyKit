import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { parseMarkers, parsePhases, phaseNumber } from "../../src/core/markers.js";

describe("parseMarkers (FR-001, FR-002, FR-003)", () => {
  it("returns the input untouched when there is no marker", () => {
    const rest = "[P] [US1] Add the parser (src/a.ts, src/b.ts)";
    expect(parseMarkers(rest)).toEqual({ body: rest });
  });

  it("reads the glyph form of BLOCKED", () => {
    expect(parseMarkers("Do it (src/a.ts) ⚠ BLOCKED: waiting on the API key")).toEqual({
      body: "Do it (src/a.ts)",
      blocked: "waiting on the API key",
    });
  });

  it("reads the glyph-less ASCII form of BLOCKED", () => {
    expect(parseMarkers("Do it (src/a.ts) BLOCKED: waiting on the API key")).toEqual({
      body: "Do it (src/a.ts)",
      blocked: "waiting on the API key",
    });
  });

  it("reads DEVIATION with and without its glyph", () => {
    expect(parseMarkers("Do it ↪ DEVIATION: used a stub").deviation).toBe("used a stub");
    expect(parseMarkers("Do it DEVIATION: used a stub").deviation).toBe("used a stub");
  });

  it("reads both markers on one line, in either order", () => {
    const a = parseMarkers("Do it (src/a.ts) ⚠ BLOCKED: no key ↪ DEVIATION: stubbed");
    expect(a).toEqual({ body: "Do it (src/a.ts)", blocked: "no key", deviation: "stubbed" });
    const b = parseMarkers("Do it (src/a.ts) ↪ DEVIATION: stubbed ⚠ BLOCKED: no key");
    expect(b).toEqual({ body: "Do it (src/a.ts)", blocked: "no key", deviation: "stubbed" });
  });

  it("flags an empty reason as blocked with an empty string", () => {
    expect(parseMarkers("Do it (src/a.ts) ⚠ BLOCKED:").blocked).toBe("");
    expect(parseMarkers("Do it (src/a.ts) BLOCKED:   ").blocked).toBe("");
  });

  it("joins several BLOCKED markers on one line with ' | '", () => {
    expect(parseMarkers("Do it ⚠ BLOCKED: no key ⚠ BLOCKED: no network").blocked).toBe("no key | no network");
  });

  it("keeps parentheses and backticks in a reason out of the body", () => {
    const m = parseMarkers("Do it (src/a.ts) ⚠ BLOCKED: needs `src/x.ts` (not merged yet)");
    expect(m.body).toBe("Do it (src/a.ts)");
    expect(m.blocked).toBe("needs `src/x.ts` (not merged yet)");
  });

  it("ignores marker keywords inside backtick code spans (documentation, not markers)", () => {
    const rest = "Document `⚠ BLOCKED: <reason>` and `BLOCKED: x` in the template (src/templates/tasks.md)";
    expect(parseMarkers(rest)).toEqual({ body: rest });
  });

  it("does not read a keyword that is part of another word", () => {
    expect(parseMarkers("Fix UNBLOCKED: flow (src/a.ts)")).toEqual({ body: "Fix UNBLOCKED: flow (src/a.ts)" });
    expect(parseMarkers("Handle the x-BLOCKED: label (src/a.ts)").blocked).toBeUndefined();
  });

  it("tolerates a trailing carriage return", () => {
    expect(parseMarkers("Do it (src/a.ts) ⚠ BLOCKED: no key\r").blocked).toBe("no key");
  });
});

describe("parseTasks with markers (FR-002, FR-012)", () => {
  it("recovers the path group, story and [P] on a marked line", () => {
    const [t] = parseTasks("- [ ] [T001] [P] [US-2] Do it (src/a.ts, test/a.test.ts) ⚠ BLOCKED: no key ↪ DEVIATION: stub");
    expect(t).toMatchObject({
      id: "T001",
      done: false,
      story: "US2",
      parallel: true,
      paths: ["src/a.ts", "test/a.test.ts"],
      description: "Do it (src/a.ts, test/a.test.ts)",
      blocked: "no key",
      deviation: "stub",
    });
    expect(t?.pathIssue).toBeUndefined();
  });

  it("a deviation never changes checked state, id, [P] or ownership", () => {
    const plain = parseTasks("- [x] [T002] [P] Do it (src/a.ts)")[0];
    const marked = parseTasks("- [x] [T002] [P] Do it (src/a.ts) ↪ DEVIATION: used a stub")[0];
    expect(marked).toMatchObject({ id: plain?.id, done: plain?.done, parallel: plain?.parallel, paths: plain?.paths, description: plain?.description });
    expect(marked?.deviation).toBe("used a stub");
    expect(marked?.blocked).toBeUndefined();
  });

  it("reports no marker fields on a task without markers", () => {
    const [t] = parseTasks("- [ ] [T003] Plain task (src/a.ts)");
    expect(t).toBeDefined();
    expect("blocked" in (t as object)).toBe(false);
    expect("deviation" in (t as object)).toBe(false);
  });

  it("works with CRLF line endings", () => {
    const tasks = parseTasks("## Phase 1\r\n- [ ] [T001] Do it (src/a.ts) ⚠ BLOCKED: no key\r\n- [ ] [T002] Next (src/b.ts)\r\n");
    expect(tasks.map((t) => [t.id, t.blocked])).toEqual([
      ["T001", "no key"],
      ["T002", undefined],
    ]);
    expect(tasks[0]?.paths).toEqual(["src/a.ts"]);
  });
});

describe("phaseNumber", () => {
  it("takes N from 'Phase N', else the ordinal", () => {
    expect(phaseNumber("Phase 3 — Stories", 9)).toBe(3);
    expect(phaseNumber("phase 12", 1)).toBe(12);
    expect(phaseNumber("Polish", 4)).toBe(4);
  });
});

describe("parsePhases (FR-005, FR-006)", () => {
  const body = [
    "# Tasks",
    "",
    "## Phase 1 — Setup",
    "- [x] [T001] Do it (src/a.ts)",
    "- **Verify:** `npm test` ✓ passed",
    "",
    "## Phase 2 — Stories",
    "- [ ] [T010] Work (src/b.ts)",
    "- **Verify:** `npm run typecheck` ✗ failed: type error in b.ts",
    "",
    "## Polish",
    "- [ ] [T020] Tidy (src/c.ts)",
    "**Verify:** `npm test` ? unverified",
    "",
    "## Phase 5",
    "- [ ] [T030] No verify line (src/d.ts)",
    "",
  ].join("\n");

  it("reads the check and result of each phase", () => {
    const phases = parsePhases(body);
    expect(phases.map((p) => [p.phase, p.check, p.result, p.why])).toEqual([
      [1, "`npm test`", "passed", undefined],
      [2, "`npm run typecheck`", "failed", "type error in b.ts"],
      [3, "`npm test`", "unverified", undefined],
      [5, undefined, undefined, undefined],
    ]);
    expect(phases.map((p) => p.tasks)).toEqual([1, 1, 1, 1]);
  });

  it("accepts the glyph-less result words", () => {
    const phases = parsePhases(
      ["## Phase 1", "- [ ] [T001] a (a.ts)", "- **Verify:** `x` passed", "## Phase 2", "- [ ] [T002] b (b.ts)", "- **Verify:** `y` failed: boom", "## Phase 3", "- [ ] [T003] c (c.ts)", "- **Verify:** `z` unverified"].join("\n"),
    );
    expect(phases.map((p) => [p.result, p.why])).toEqual([
      ["passed", undefined],
      ["failed", "boom"],
      ["unverified", undefined],
    ]);
  });

  it("leaves result undefined when none is recorded", () => {
    const [p] = parsePhases("## Phase 1\n- [ ] [T001] a (a.ts)\n- **Verify:** `npm test`\n");
    expect(p).toMatchObject({ phase: 1, check: "`npm test`" });
    expect(p?.result).toBeUndefined();
  });

  it("numbers phases exactly like parseTasks does", () => {
    const tasks = parseTasks(body);
    const phases = parsePhases(body);
    for (const t of tasks) expect(phases.some((p) => p.phase === t.phase), t.id).toBe(true);
    expect(tasks.map((t) => t.phase)).toEqual([1, 2, 3, 5]);
  });

  it("counts extra Verify lines in one phase and uses the first", () => {
    const [p] = parsePhases("## Phase 1\n- [ ] [T001] a (a.ts)\n- **Verify:** `one` ✓ passed\n- **Verify:** `two` ✗ failed: x\n");
    expect(p).toMatchObject({ check: "`one`", result: "passed", duplicates: 1 });
  });

  it("ignores a Verify line outside any phase", () => {
    expect(parsePhases("**Verify:** `npm test`\n- [ ] [T001] a (a.ts)\n")).toEqual([]);
  });

  it("handles CRLF", () => {
    const [p] = parsePhases("## Phase 1\r\n- [ ] [T001] a (a.ts)\r\n- **Verify:** `npm test` ✓ passed\r\n");
    expect(p).toMatchObject({ check: "`npm test`", result: "passed" });
  });
});

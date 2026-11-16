import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { parsePhases } from "../../src/core/markers.js";

/** A tasks.md body: one phase per entry, each with one task and the given Verify lines. */
function tasksMd(phases: Array<{ title: string; verify: string[] }>): string {
  const out = ["---", "feature: 001-demo", "---", "", "# Tasks", ""];
  phases.forEach((p, i) => {
    out.push(`## ${p.title}`, "", `- [ ] [T0${i}1] [US1] Work (src/f${i}.ts)`);
    for (const v of p.verify) out.push(v);
    out.push("");
  });
  return out.join("\n");
}

describe("parsePhases: Verify lines and their results (spec 020, US-3)", () => {
  it("FR-005: a phase with a Verify line reads its check and no result", () => {
    const [p] = parsePhases(tasksMd([{ title: "Phase 1", verify: ["- **Verify:** `npm test`"] }]));
    expect(p).toMatchObject({ phase: 1, tasks: 1, check: "`npm test`", duplicates: 0 });
    expect(p?.result).toBeUndefined();
  });

  it("FR-006: ✓ passed is a pass, with or without the glyph", () => {
    const md = tasksMd([
      { title: "Phase 1", verify: ["- **Verify:** `npm test` ✓ passed"] },
      { title: "Phase 2", verify: ["- **Verify:** `npm test` passed"] },
    ]);
    const [a, b] = parsePhases(md);
    expect(a).toMatchObject({ check: "`npm test`", result: "passed" });
    expect(b).toMatchObject({ check: "`npm test`", result: "passed" });
  });

  it("FR-006: ✗ failed keeps its reason, with or without the glyph", () => {
    const md = tasksMd([
      { title: "Phase 1", verify: ["- **Verify:** `npm test` ✗ failed: 3 tests red (golden)"] },
      { title: "Phase 2", verify: ["- **Verify:** `npm test` failed: no network"] },
      { title: "Phase 3", verify: ["- **Verify:** `npm test` ✗ failed"] },
    ]);
    const [a, b, c] = parsePhases(md);
    expect(a).toMatchObject({ result: "failed", why: "3 tests red (golden)", check: "`npm test`" });
    expect(b).toMatchObject({ result: "failed", why: "no network" });
    expect(c).toMatchObject({ result: "failed", why: "" });
  });

  it("FR-008: ? unverified is recorded as unverified, glyph or not", () => {
    const md = tasksMd([
      { title: "Phase 1", verify: ["- **Verify:** open the page and look ? unverified"] },
      { title: "Phase 2", verify: ["- **Verify:** open the page and look unverified"] },
    ]);
    const [a, b] = parsePhases(md);
    expect(a).toMatchObject({ result: "unverified", check: "open the page and look" });
    expect(b).toMatchObject({ result: "unverified", check: "open the page and look" });
  });

  it("FR-006/FR-007: a later run overwrites the result, so an old failure is not shown as current", () => {
    const failed = parsePhases(tasksMd([{ title: "Phase 1", verify: ["- **Verify:** `npm test` ✗ failed: red"] }]));
    expect(failed[0]?.result).toBe("failed");
    // The implementer rewrites the same line in place after fixing the cause.
    const fixed = parsePhases(tasksMd([{ title: "Phase 1", verify: ["- **Verify:** `npm test` ✓ passed"] }]));
    expect(fixed[0]?.result).toBe("passed");
    expect(fixed[0]?.why).toBeUndefined();
  });

  it("a check whose own text ends in a result word is not mistaken for one while there is a suffix", () => {
    const [p] = parsePhases(tasksMd([{ title: "Phase 1", verify: ["- **Verify:** `ambykit sync --check` ✓ passed"] }]));
    expect(p).toMatchObject({ check: "`ambykit sync --check`", result: "passed" });
  });

  it("edge: several Verify lines in one phase use the first and count the rest", () => {
    const [p] = parsePhases(
      tasksMd([{ title: "Phase 1", verify: ["- **Verify:** `one` ✓ passed", "- **Verify:** `two` ✗ failed: x"] }]),
    );
    expect(p).toMatchObject({ check: "`one`", result: "passed", duplicates: 1 });
  });

  it("edge: a Verify line outside any phase belongs to nothing", () => {
    const md = ["# Tasks", "", "**Verify:** `npm test`", "", "## Phase 1", "", "- [ ] [T001] [US1] Work (src/a.ts)", ""].join("\n");
    const phases = parsePhases(md);
    expect(phases).toHaveLength(1);
    expect(phases[0]?.check).toBeUndefined();
  });

  it("edge: a feature with no phases yields nothing", () => {
    expect(parsePhases("# Tasks\n\nNo phases yet.\n")).toEqual([]);
  });

  it("edge: the plain `**Verify:**` form (no list dash) is read too", () => {
    const [p] = parsePhases("## Phase 1\n\n- [ ] [T001] [US1] Work (src/a.ts)\n\n**Verify:** `npm test` ✓ passed\n");
    expect(p).toMatchObject({ check: "`npm test`", result: "passed" });
  });

  it("FR-005: phase numbering equals parseTasks numbering, so the two never drift", () => {
    const md = tasksMd([
      { title: "Phase 1 — Setup", verify: ["- **Verify:** `a`"] },
      { title: "Foundational", verify: [] },
      { title: "Phase 7 — Late", verify: ["- **Verify:** `c` ? unverified"] },
    ]);
    const fromPhases = parsePhases(md).map((p) => p.phase);
    const fromTasks = [...new Set(parseTasks(md).map((t) => t.phase))];
    expect(fromPhases).toEqual(fromTasks);
  });
});

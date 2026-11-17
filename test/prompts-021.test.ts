import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 021 prompt contract. The rules of test design live in the neutral prompts (Principle 1), so the
 * tests pin the sentences a model must follow, and a size cap keeps them short (Principle 3).
 */
const root = join(import.meta.dirname, "..");
const read = (rel: string): string => readFileSync(join(root, rel), "utf8");
const tasks = read("src/prompts/tasks.md");
const implement = read("src/prompts/implement.md");
const converge = read("src/prompts/converge.md");
const revise = read("src/prompts/revise.md");
const frontmatter = (text: string): string => /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, "\n"))?.[1] ?? "";

describe("spec 021 prompt contract: /amby.tasks writes the test design", () => {
  it("021:FR-010, 021:FR-012: the tasks phase also writes tests.md, and there is no new command", () => {
    expect(frontmatter(tasks)).toMatch(/writes: \[[^\]]*specs\/NNN-slug\/tests\.md/);
    const prompts = readdirSync(join(root, "src", "prompts"));
    expect(prompts.filter((f) => /test/i.test(f))).toEqual([]);
  });

  it("021:FR-010: it touches only tasks.md and tests.md, in the same phase, from the template", () => {
    expect(tasks).toMatch(/in this phase per `@\.amby\/templates\/tests\.md`/);
    expect(tasks).toMatch(/touching only `tasks\.md`\s+and `tests\.md`/);
  });

  it("021:FR-002: a spec that is not ready stops test design and says so", () => {
    expect(tasks).toMatch(/not `status: ready`, skip it and say the spec must be ready first/);
  });

  it("021:FR-001, 021:FR-003: one case per criterion, negative and edge ones too, vague ones to Flags", () => {
    expect(tasks).toMatch(/One case per\s+acceptance criterion \(negative and edge ones too, max 15 per story\)/);
    expect(tasks).toMatch(/too vague to test goes under `## Flags`/);
  });

  it("021:FR-006, 021:FR-005: auto by default; manual only for a fixed-list reason with verify and record", () => {
    expect(tasks).toMatch(/Cases are `auto` unless a fixed-list reason makes them manual \(add `verify:` and `record:`\)/);
  });

  it("021:FR-004, 021:FR-007, 021:FR-009: cases cite US-n#k and FR ids, TC ids are never reused, uncovered FRs get a reason", () => {
    expect(tasks).toMatch(/Each cites its `US-n#k`\s+and `FR-###`s/);
    expect(tasks).toMatch(/`TC-###` is highest \+ 1, never reused/);
    expect(tasks).toMatch(/An FR with no case goes under `## Uncovered` with a reason/);
  });

  it("021:FR-016: a person can skip test design explicitly, recorded as a one-line `skipped:` file", () => {
    expect(frontmatter(tasks)).toMatch(/argument-hint: .*--skip-tests <reason>/);
    expect(tasks).toMatch(/With `--skip-tests <reason>`, write `tests\.md` holding only the line `skipped: <reason>`/);
  });

  it("P3: the test-design rules stay short (the whole tasks prompt under 3000 characters)", () => {
    expect(tasks.length).toBeLessThan(3000);
  });
});

describe("spec 021 prompt contract: the other phases use the test design", () => {
  it("021:FR-011: /amby.implement says when tests.md is missing at the checkpoint instead of passing silently", () => {
    expect(frontmatter(implement)).toMatch(/reads: \[[^\]]*specs\/NNN-slug\/tests\.md/);
    expect(implement).toMatch(/at the story checkpoint say if `tests\.md` is missing, never pass silently/);
  });

  it("021:FR-012: /amby.implement builds to the story's cases and names tests with the qualified id", () => {
    expect(implement).toMatch(/build to the story's cases in `tests\.md` and name tests `NNN:FR-###: …`/);
  });

  it("021:FR-014: /amby.converge reads tests.md after the trace matrix and treats its cases as the expected tests", () => {
    expect(frontmatter(converge)).toMatch(/reads: \[[^\]]*specs\/NNN-slug\/tests\.md/);
    expect(converge).toMatch(/read it after the `trace` matrix \(where there is one\) and treat its cases as the expected tests/);
  });

  it("021:FR-013: re-running /amby.tasks patches only the cases citing changed criteria and keeps their ids", () => {
    expect(tasks).toMatch(/patch only the cases citing changed criteria \(keep their ids, clear `\[stale\]`\)/);
    expect(tasks).toMatch(/mark\s+cases whose criterion was removed `\[obsolete\]`/);
  });

  it("021:FR-013: /amby.revise marks cases `[stale]` or `[obsolete]` and never deletes them", () => {
    expect(frontmatter(revise)).toMatch(/writes: \[[^\]]*specs\/NNN-slug\/tests\.md/);
    expect(revise).toMatch(/mark each case citing a changed criterion `\[stale\]` and each citing a removed one\s+`\[obsolete\]` \(never delete\)/);
  });

  it("P3: every edited prompt stays short", () => {
    for (const text of [implement, converge, revise]) expect(text.length).toBeLessThan(3000);
  });
});

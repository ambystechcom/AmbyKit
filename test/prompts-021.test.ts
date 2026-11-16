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

  it("P3: the test-design rules stay short (the whole tasks prompt under 3000 characters)", () => {
    expect(tasks.length).toBeLessThan(3000);
  });
});

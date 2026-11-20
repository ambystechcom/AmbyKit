import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSpec, readTasks } from "../src/core/spec-format/dispatch.js";

/**
 * 030:FR-017 — feature 030 reaches the assistant through template and prompt text only. These assertions pin the contract:
 * new features start in v2, every status, ownership and Verify change goes through the writer (`ambykit edit`), no prompt
 * tells the assistant to edit a block by hand, and the prompts stay short (Principle 3).
 */
const read = (rel: string): string => readFileSync(join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");

const specTemplate = read("src/templates/spec.md");
const tasksTemplate = read("src/templates/tasks.md");
const prompts = {
  specify: read("src/prompts/specify.md"),
  tasks: read("src/prompts/tasks.md"),
  implement: read("src/prompts/implement.md"),
  revise: read("src/prompts/revise.md"),
  converge: read("src/prompts/converge.md"),
  run: read("src/prompts/run.md"),
  worker: read("src/agents/worker.md"),
};

/** The templates with their placeholders filled in the way an assistant would. */
const fill = (t: string): string =>
  t
    .replace(/\{\{FEATURE_ID\}\}/g, "900-demo")
    .replace(/\{\{FEATURE_TITLE\}\}/g, "Demo")
    .replace(/\{\{BRANCH\}\}/g, "900-demo")
    .replace(/\{\{DATE\}\}/g, "2026-11-18")
    .replace(/\{\{PATH\}\}/g, "src/a.ts")
    .replace(/\{\{VERIFY_CHECK\}\}/g, "npm test passes")
    .replace(/\{\{[A-Z_]+\}\}/g, "text");

describe("v2 templates (030, US-11, FR-017)", () => {
  it("030:FR-017: the spec template is v2: format 2, a stories list, no metadata bullets, no priority in the heading", () => {
    expect(specTemplate).toMatch(/^---\nformat: 2\n/);
    expect(specTemplate).toMatch(/^stories:/m);
    expect(specTemplate).not.toMatch(/^- \*\*(status|depends-on|blocked-by):\*\*/m);
    expect(specTemplate).not.toMatch(/\(priority: P\d\)/);
    expect(specTemplate).toContain("ambykit edit status <feature> US-# <status>");
  });

  it("030:FR-017: a filled-in spec template reads as a v2 spec with one draft P1 story and no issue", () => {
    const r = readSpec("900-demo", fill(specTemplate));
    expect(r.format).toBe(2);
    expect(r.issues).toEqual([]);
    expect(r.stories).toHaveLength(1);
    expect(r.stories[0]).toMatchObject({ id: "US1", priority: "P1", status: "draft" });
  });

  it("030:FR-017: the tasks template is v2: format 2, one yaml block per phase, no trailing group on a task line", () => {
    expect(tasksTemplate).toMatch(/^---\nformat: 2\n/);
    const phases = (tasksTemplate.match(/^## /gm) ?? []).length;
    expect((tasksTemplate.match(/^```yaml$/gm) ?? []).length).toBe(phases);
    expect((tasksTemplate.match(/^verify:/gm) ?? []).length).toBe(phases);
    expect(tasksTemplate).not.toMatch(/^- \[[ x]\] \[T\d+\].*\(\{\{PATH\}\}\)\s*$/m);
    expect(tasksTemplate).toContain("`⚠ BLOCKED: <reason>`");
    expect(tasksTemplate).toContain("`↪ DEVIATION: <note>`");
    expect(tasksTemplate).toContain("ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]");
  });

  it("030:FR-017: a filled-in tasks template reads as a v2 tasks file: every task owns a file and every phase has a check", () => {
    const r = readTasks(fill(tasksTemplate));
    expect(r.format).toBe(2);
    expect(r.issues).toEqual([]);
    expect(r.tasks.length).toBeGreaterThanOrEqual(5);
    for (const t of r.tasks) expect(t.paths, t.id).toEqual(["src/a.ts"]);
    for (const p of r.phases) expect(p.check, p.title).toBe("npm test passes");
  });
});

describe("prompts use the writer (030, US-11, FR-017)", () => {
  it("030:FR-017: /amby.specify puts story data in the frontmatter list and checks the spec with analyze", () => {
    expect(prompts.specify).toMatch(/frontmatter `stories:` list; the heading carries the title only/);
    expect(prompts.specify).toContain("`status: draft`");
    expect(prompts.specify).toContain("ambykit analyze");
  });

  it("030:FR-017: /amby.tasks writes v2: ownership in the files block, exactly one verify, then analyze", () => {
    expect(prompts.tasks).toMatch(/v2 form of `@\.amby\/templates\/tasks\.md`/);
    expect(prompts.tasks).toMatch(/list its files in its phase's `files:` block, never on the task\s+line/);
    expect(prompts.tasks).toMatch(/exactly ONE `verify:` in its block/);
    expect(prompts.tasks).toContain("ambykit analyze");
  });

  it("030:FR-017: /amby.implement ticks directly and uses the writer for status, files and Verify results", () => {
    const p = prompts.implement;
    expect(p).toContain("flip the completed task's checkbox to `- [x]`");
    expect(p).toContain("ambykit edit status <feature> US-# in-progress");
    expect(p).toContain("ambykit edit status <feature> US-# done");
    expect(p).toContain("ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]");
    expect(p).toMatch(/Never edit story data, files or Verify results by hand: use\s+`ambykit edit status\|files\|verify`/);
    expect(p).toContain("ambykit analyze");
  });

  it("030:FR-017: /amby.revise and /amby.converge change statuses through the writer", () => {
    expect(prompts.revise).toContain("ambykit edit status <feature> US-# <status>");
    expect(prompts.revise).toContain("ambykit analyze");
    expect(prompts.converge).toContain("ambykit edit status <feature> US-# done");
  });

  it("030:FR-017: /amby.run records Verify results and finished stories through the writer; the worker leaves blocks to the lead", () => {
    expect(prompts.run).toContain("ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]");
    expect(prompts.run).toContain("ambykit edit status <feature> US-# done");
    expect(prompts.worker).toMatch(/Never edit a\s+phase's `files:`\/`verify:` block or a story's status by hand/);
  });

  it("030:FR-017: no prompt tells the assistant to edit a block or story data by hand (every 'by hand' is a prohibition)", () => {
    for (const [name, text] of Object.entries(prompts)) {
      const joined = text.replace(/\n\s*/g, " ");
      for (const m of joined.matchAll(/[^.]*\bby hand\b[^.]*\./g)) {
        const sentence = m[0];
        // `fleet release` after a hand edit of a tick is about a checkbox, which is allowed to be edited directly
        if (/checkbox|\[ \]|`\[x\]`|edited by hand, also run/.test(sentence)) continue;
        expect(sentence, `${name}: ${sentence.trim()}`).toMatch(/\b(never|Never)\b/);
      }
    }
  });

  it("030:FR-017: every `ambykit edit` in a prompt names a verb the writer has", () => {
    for (const [name, text] of Object.entries(prompts)) {
      for (const m of text.matchAll(/ambykit edit (\S+)/g)) {
        expect(m[1], name).toMatch(/^(files|verify|status|status\|files\|verify`?)/);
      }
    }
  });
});

describe("prompt size caps (030, Principle 3)", () => {
  // Each cap is a little above today's size (measured at 030), so growth stays visible and deliberate.
  const caps: Record<keyof typeof prompts, number> = { specify: 2300, tasks: 3000, implement: 3000, revise: 3000, converge: 3000, run: 8000, worker: 3000 };
  for (const [name, cap] of Object.entries(caps)) {
    it(`030:FR-017: ${name} stays under ${cap} characters`, () => {
      expect(prompts[name as keyof typeof prompts].length).toBeLessThan(cap);
    });
  }
});

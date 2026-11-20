import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 020 reaches the assistant through prompt and template text only, so the emitter goldens were its
 * sole cover, and a golden can simply be re-recorded. These assertions pin the contract itself.
 */
const read = (rel: string): string => readFileSync(join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");

const implement = read("src/prompts/implement.md");
const tasksPrompt = read("src/prompts/tasks.md");
const template = read("src/templates/tasks.md");

/** The text of one numbered step of the implement prompt (up to the next step number). */
function step(n: number): string {
  const start = implement.indexOf(`
${n}. `);
  if (start === -1) return "";
  const next = implement.indexOf(`
${n + 1}. `, start + 1);
  return implement.slice(start + 1, next === -1 ? undefined : next);
}

describe("spec 020 prompt contract: implement", () => {
  it("FR-015, FR-016: tells the implementer to mark a block as the last segment, then stop that task and continue", () => {
    const s = step(3);
    expect(s).toContain("⚠ BLOCKED: <reason>");
    // feature 030: a v2 task line has no `(file/path)` group, so it is "if it has one"
    expect(s).toMatch(/last\s+segment of its line \(after its `\(file\/path\)` group, if it has one\)/);
    expect(s).toMatch(/stop that task and continue with another unblocked\s+one/);
    expect(s).toContain("↪ DEVIATION: <note>");
    expect(s).toMatch(/Remove `⚠ BLOCKED:` once resolved/);
  });

  it("FR-006: runs the phase's Verify check before passing the checkpoint and records the result through the writer", () => {
    const s = step(5);
    // feature 030: the Verify check is a `**Verify:**` line (1.x) or a `verify:` block (v2); the result goes through the writer
    expect(s).toMatch(/run that phase's Verify check \(its `\*\*Verify:\*\*` line or `verify:` block\) before passing it/);
    expect(s).toContain("ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]");
    expect(s).toMatch(/replacing any earlier one/);
  });

  it("FR-007: never passes the checkpoint on a failure", () => {
    expect(step(5)).toMatch(/Never pass the checkpoint on a failure: fix it and run again/);
  });

  it("FR-008: a check it cannot run goes to a person and is recorded as unverified", () => {
    expect(step(5)).toMatch(/cannot run the check, ask a person to run or\s+confirm it and record `unverified`/);
  });

  it("FR-007, SC-003: a story is set to done only after its phase Verify has passed (not at step 4)", () => {
    expect(step(4)).not.toMatch(/US-# done/);
    expect(step(4)).toContain("ambykit edit status <feature> US-# in-progress");
    const five = step(5);
    expect(five).toContain("ambykit edit status <feature> US-# done");
    expect(five.indexOf("Verify has passed")).toBeGreaterThan(-1);
    expect(five.indexOf("US-# done")).toBeGreaterThan(five.indexOf("Verify has passed"));
  });

  it("SC-005: in a lane, the Verify result is recorded after the phase's lanes are merged", () => {
    expect(step(5)).toMatch(/In a lane, record the result after the phase's lanes are merged/);
  });

  it("P3, SC-004: the prompt stays short", () => {
    expect(implement.length).toBeLessThan(3000);
  });
});

describe("spec 020 prompt contract: tasks prompt and template", () => {
  it("FR-005, FR-015: /amby.tasks emits exactly one Verify check per phase (a `verify:` in the phase block since feature 030)", () => {
    expect(tasksPrompt).toMatch(/exactly ONE `verify:` in its block/);
    // 2200 until spec 021 added its test-design steps (about 700 characters); still a cap, so growth stays visible.
    expect(tasksPrompt.length).toBeLessThan(3000);
  });

  it("FR-005, FR-015: the template ends every phase with a Verify line and documents the markers and result suffix", () => {
    const phases = (template.match(/^## /gm) ?? []).length;
    const verify = (template.match(/^verify:/gm) ?? []).length;
    expect(verify).toBeGreaterThan(0);
    expect(verify).toBe(phases);
    expect(template).toContain("`⚠ BLOCKED: <reason>`");
    expect(template).toContain("`↪ DEVIATION: <note>`");
    expect(template).toMatch(/last|after the path group/);
    expect(template).toContain("`✓ passed`");
    expect(template).toContain("`✗ failed: <why>`");
    expect(template).toContain("`? unverified`");
  });
});

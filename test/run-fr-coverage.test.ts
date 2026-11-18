import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Principle 5 for feature 028: every `FR-###` of the spec is cited by at least one test, using the qualified
 * form `028:FR-###` at the start of the test name (spec 024's convention). The ids come from the spec itself,
 * so a requirement added later fails here until a test cites it.
 */

const ROOT = resolve(__dirname, "..");

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "fixtures" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (/\.test\.ts$/.test(name)) out.push(full);
  }
  return out;
}

const spec = readFileSync(join(ROOT, "specs", "028-ambykit-run", "spec.md"), "utf8");
const requirements = [...new Set([...spec.matchAll(/^- (FR-\d{3})\b/gm)].map((m) => m[1]!))];
const successCriteria = [...new Set([...spec.matchAll(/^- (SC-\d{3})\b/gm)].map((m) => m[1]!))];
const names = testFiles(join(ROOT, "test"))
  .filter((f) => !f.endsWith("run-fr-coverage.test.ts"))
  .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\bit(?:\.each\([^)]*\))?\(\s*["'`](028:(?:FR|SC)-\d{3}[^"'`]*)["'`]/g)].map((m) => m[1]!));

describe("028 requirement coverage (Principle 5)", () => {
  it("028:SC-007: the spec's requirements were found", () => {
    expect(requirements.length).toBe(20);
    expect(successCriteria.length).toBeGreaterThanOrEqual(9);
  });

  it.each(requirements)("028:SC-007: %s is cited by at least one test", (fr) => {
    const hits = names.filter((n) => n.startsWith(`028:${fr}:`) || n.startsWith(`028:${fr},`));
    expect(hits.length, `no test name starts with 028:${fr}:`).toBeGreaterThan(0);
  });

  it.each(["SC-002", "SC-003", "SC-004", "SC-005", "SC-006", "SC-009"])("028:SC-007: %s that can be tested by a fake runner is cited by a test", (sc) => {
    expect(names.some((n) => n.startsWith(`028:${sc}:`)), `no test name starts with 028:${sc}:`).toBe(true);
  });
});

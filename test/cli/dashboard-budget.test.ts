import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { worktreePerfFixture } from "../helpers/dashboard-perf-fixture.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 032, US-5: the redesign must not slow or reshape the non-interactive output. This records the field names of
 * `dashboard --json` and `--json --overview` as they are today (additions are allowed, removals and renames are not)
 * and measures one-shot and `--json` on the largest fixture against the one-second budget.
 * Re-record with UPDATE_JSON_FIELDS_032=1 only for a deliberate, reviewed change.
 */
const file = join(import.meta.dirname, "..", "fixtures", "dashboard-json-fields.json");
const BUDGET_MS = 1000;

/** Every key path in a JSON value; array elements collapse to `[]`. */
export function fieldPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap((v) => fieldPaths(v, `${prefix}[]`)))];
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
      const p = prefix ? `${prefix}.${k}` : k;
      return [p, ...fieldPaths(v, p)];
    });
  }
  return [];
}

const run = async (root: string, flags: Record<string, string | boolean>) => runCommand(new DashboardCommand(), root, [], flags);

/** Best of three, so one slow scheduling hiccup under load does not fail a budget the code meets. */
async function bestMs(root: string, flags: Record<string, string | boolean>): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const r = await run(root, flags);
    best = Math.min(best, performance.now() - t0);
    expect(r.code).toBe(0);
  }
  return best;
}

describe.skipIf(!HAS_GIT)("dashboard JSON fields and one-second budget (feature 032, US-5)", () => {
  it("032:FR-010: every recorded --json and --json --overview field is still present", async () => {
    const root = worktreePerfFixture(8, 2);
    const now = {
      json: [...new Set(fieldPaths(JSON.parse((await run(root, { json: true })).out)))].sort(),
      overview: [...new Set(fieldPaths(JSON.parse((await run(root, { json: true, overview: true })).out)))].sort(),
    };
    if (process.env["UPDATE_JSON_FIELDS_032"]) writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const recorded = JSON.parse(readFileSync(file, "utf8")) as typeof now;
    expect(now.json).toEqual(expect.arrayContaining(recorded.json));
    expect(now.overview).toEqual(expect.arrayContaining(recorded.overview));
    expect(recorded.overview.length).toBeGreaterThan(5);
  });

  it("032:FR-009: one-shot and --json stay under one second on the largest fixture", async () => {
    const root = worktreePerfFixture(50, 10);
    expect(await bestMs(root, {})).toBeLessThan(BUDGET_MS);
    expect(await bestMs(root, { json: true, overview: true })).toBeLessThan(BUDGET_MS);
  }, 60_000);
});

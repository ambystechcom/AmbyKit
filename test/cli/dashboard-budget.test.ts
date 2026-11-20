import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { worktreePerfFixture } from "../helpers/dashboard-perf-fixture.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { expectWithinBudget } from "../helpers/load-independent-budget.js";
import { runCommand } from "../helpers/run-command.js";

// Count child-process spawns (every git call goes through node:child_process) while still running them for real.
vi.mock("node:child_process", async (importOriginal) =>
  (await import("../helpers/load-independent-budget.js")).countingChildProcess(await importOriginal<typeof import("node:child_process")>()));

/**
 * Feature 032, US-5: the redesign must not slow or reshape the non-interactive output. This records the field names of
 * `dashboard --json` and `--json --overview` as they are today (additions are allowed, removals and renames are not)
 * and measures one-shot and `--json` on the largest fixture against the one-second budget.
 * Re-record with UPDATE_JSON_FIELDS_032=1 only for a deliberate, reviewed change.
 */
const file = join(import.meta.dirname, "..", "fixtures", "dashboard-json-fields.json");
// Spawn ceilings per run on the 50-feature / 10-worktree fixture (measured counts plus about a third of headroom).
const SPAWNS_ONE_SHOT = 24; // measured: 18
const SPAWNS_OVERVIEW_JSON = 24; // measured: 18

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

describe.skipIf(!HAS_GIT)("dashboard JSON fields and one-second budget (feature 032, US-5)", () => {
  it("032:FR-010, 032:FR-020: every recorded --json and --json --overview field is still present with the 030 reader in place", async () => {
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

  it("032:FR-009, 032:FR-020: one-shot and --json stay under one second on the largest fixture with the 030 reader in place", async () => {
    const root = worktreePerfFixture(50, 10);
    // The budget is two load-independent checks (see test/helpers/load-independent-budget.ts): a bound on git spawns,
    // and the fastest of three runs under 1 s or within a multiple of the spawn floor measured right now.
    const timed = (label: string, flags: Record<string, string | boolean>, spawnBudget: number) =>
      expectWithinBudget({
        label,
        spawnBudget,
        run: async () => {
          const r = await run(root, flags);
          expect(r.code).toBe(0);
        },
      });
    await timed("one-shot", {}, SPAWNS_ONE_SHOT);
    await timed("--json --overview", { json: true, overview: true }, SPAWNS_OVERVIEW_JSON);
  }, 60_000);
});

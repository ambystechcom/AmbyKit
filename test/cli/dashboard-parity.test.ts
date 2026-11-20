import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 032, FR-017: the redesign changes the interactive dashboard only. One-shot, `--stories`, `--json` and
 * `--json --overview` output on the standard fixture equals what release 1.6.0 printed (the fixture was recorded from
 * the 1.6.0 build). Re-record with UPDATE_PARITY_032=1 only for a deliberate, reviewed change.
 */
const file = join(import.meta.dirname, "..", "fixtures", "dashboard-parity-032.json");
const CASES: Record<string, Record<string, string | boolean>> = {
  "one-shot": {},
  "one-shot-ascii": { icons: "ascii" },
  stories: { stories: true },
  json: { json: true },
  "json-overview": { json: true, overview: true },
  "one-shot-filtered": { status: "in-progress" },
};
/** The header line carries the working directory, which differs per run. */
const withoutHeader = (out: string): string => out.split("\n").slice(1).join("\n");

async function capture(): Promise<Record<string, { code: number; out: string }>> {
  const root = dashboardFixture();
  const rec: Record<string, { code: number; out: string }> = {};
  for (const [name, flags] of Object.entries(CASES)) {
    const r = await runCommand(new DashboardCommand(), root, [], flags);
    rec[name] = { code: r.code, out: name.startsWith("json") || name === "stories" ? r.out : withoutHeader(r.out) };
  }
  return rec;
}

describe("non-interactive dashboard output is unchanged (feature 032, US-5)", () => {
  it("032:FR-017: one-shot, --stories, --json and --json --overview equal the 1.6.0 output on the fixture", async () => {
    const now = await capture();
    if (process.env["UPDATE_PARITY_032"]) writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const recorded = JSON.parse(readFileSync(file, "utf8")) as typeof now;
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(CASES).sort());
    for (const k of Object.keys(recorded)) expect(now[k], k).toEqual(recorded[k]);
  });

  it("032:FR-017: no new flag leaks into the default output: --json without --metrics has no metrics", async () => {
    const r = await runCommand(new DashboardCommand(), dashboardFixture(), [], { json: true, overview: true });
    expect(JSON.parse(r.out)).not.toHaveProperty("metrics");
  });
});

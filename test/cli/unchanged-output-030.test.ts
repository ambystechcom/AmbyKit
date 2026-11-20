import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { runCommand } from "../helpers/run-command.js";
import { BASELINE_FEATURE } from "../helpers/spec-model.js";
import { ownSpecsCopy } from "../helpers/spec-project.js";

/**
 * 030:FR-011, FR-018 (SC-003): a 1.x project's command output is unchanged by the v2 work. The fixture was recorded by
 * running the code at the start of 030 (release 1.6.0) on a copy of features 001-029 (030 itself changes while built).
 * Re-record with UPDATE_OUTPUT_030=1 only for a deliberate, reviewed change outside 030.
 */
const root = join(import.meta.dirname, "..", "..");
const file = join(root, "test", "fixtures", "unchanged-output-030.json");
const withoutHeader = (out: string): string => out.split("\n").slice(1).join("\n");

async function capture(): Promise<Record<string, { code: number; out: string }>> {
  const dir = ownSpecsCopy(BASELINE_FEATURE);
  const rec: Record<string, { code: number; out: string }> = {};
  const a = await runCommand(new AnalyzeCommand(), dir, [], {});
  rec["analyze-text"] = { code: a.code, out: a.out };
  const aj = await runCommand(new AnalyzeCommand(), dir, [], { json: true });
  rec["analyze-json"] = { code: aj.code, out: aj.out };
  const d = await runCommand(new DashboardCommand(), dir, [], {});
  rec["dashboard-text"] = { code: d.code, out: withoutHeader(d.out) };
  const da = await runCommand(new DashboardCommand(), dir, [], { icons: "ascii" });
  rec["dashboard-ascii"] = { code: da.code, out: withoutHeader(da.out) };
  const dj = await runCommand(new DashboardCommand(), dir, [], { json: true });
  rec["dashboard-json"] = { code: dj.code, out: dj.out };
  const dov = await runCommand(new DashboardCommand(), dir, [], { json: true, overview: true });
  rec["dashboard-overview"] = { code: dov.code, out: dov.out };
  return rec;
}

describe("1.x projects read exactly as before (030, phase 1 baseline)", () => {
  it("030:FR-011, FR-018: analyze and dashboard output on the own specs equals the recorded baseline", async () => {
    const now = await capture();
    if (process.env["UPDATE_OUTPUT_030"]) writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const recorded = JSON.parse(readFileSync(file, "utf8")) as typeof now;
    for (const k of Object.keys(recorded)) expect(now[k], k).toEqual(recorded[k]);
  });
});

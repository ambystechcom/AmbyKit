import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONDITIONS,
  GATE_FILE,
  RC_REPORT_FILE,
  checkRelease,
  gateApplies,
  gateProblems,
  npmViewOutcome,
  parseGate,
  pluginTaskProblems,
  rcReportProblems,
  // @ts-expect-error plain ESM script without type declarations
} from "../../scripts/release-gate.mjs";

/**
 * 034:FR-003, FR-004, FR-009 — the gate record has exactly the five US-2 conditions, a `met` row needs a date and evidence, the
 * check stops at the first unmet condition and names it, and a final version also needs the plugin preconditions (D-2) and a
 * release-candidate report from a project other than this repository.
 */
const root = resolve(__dirname, "..", "..");

const table = (rows: Array<[string, string, string, string]>) =>
  ["| ID | Condition | Result | Date | Evidence |", "|---|---|---|---|---|", ...rows.map(([id, r, d, e]) => `| ${id} | cond ${id} | ${r} | ${d} | ${e} |`)].join("\n");
const allMet = () => table(CONDITIONS.map((id: string) => [id, "met", "2026-12-01", `evidence for ${id}`]));
const tasks036 = (mark: string) => ["T034", "T035", "T037"].map((id) => `- [${mark}] [${id}] something`).join("\n");
const rcReport = "- **Project:** acme-billing\n- **Date:** 2026-12-02\n- **Result:** migrated, one feature built";
const published = () => ({ status: 0, stdout: "1.0.1\n", stderr: "" });

function files(over: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = { [GATE_FILE]: allMet(), "036-tasks": tasks036("x"), [RC_REPORT_FILE]: rcReport };
  const all = { ...base, ...over };
  return (p: string) => all[p];
}

describe("the gate record (034, US-2)", () => {
  it("034:FR-003: the committed gate holds exactly the five US-2 conditions, each pending with the task that fills it", () => {
    const rows = parseGate(readFileSync(resolve(root, GATE_FILE), "utf8"));
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["C1", "C2", "C3", "C4", "C5"]);
    for (const r of rows) {
      expect(r.result).toBe("pending");
      expect(r.evidence).toMatch(/T0\d\d/);
    }
    expect(rows.map((r: { condition: string }) => r.condition).join("\n")).toMatch(/migrated to format v2[\s\S]*1\.x files are still read[\s\S]*fleet[\s\S]*dashboard[\s\S]*Node 22/);
  });

  it("034:FR-003: a met row without a date or without evidence is not met", () => {
    const rows = parseGate(table([["C1", "met", "", "x"], ["C2", "met", "2026-12-01", ""], ["C3", "met", "yesterday", "x"], ["C4", "met", "2026-12-01", "x"], ["C5", "met", "2026-12-01", "x"]]));
    const p = gateProblems(rows);
    expect(p).toHaveLength(3);
    expect(p[0]).toMatch(/^C1 .* no date/);
    expect(p[1]).toMatch(/^C2 .* no evidence/);
    expect(p[2]).toMatch(/^C3 .* no date/);
  });

  it("034:FR-003: a missing, extra or repeated condition and an unknown result are problems", () => {
    const p = gateProblems(parseGate(table([["C1", "met", "2026-12-01", "x"], ["C1", "met", "2026-12-01", "x"], ["C6", "met", "2026-12-01", "x"], ["C2", "done", "2026-12-01", "x"]])));
    expect(p.join("\n")).toMatch(/C3 is missing/);
    expect(p.join("\n")).toMatch(/C6 is not one of the five/);
    expect(p.join("\n")).toMatch(/C1 appears more than once/);
    expect(p.join("\n")).toMatch(/C2 .*result 'done'/);
  });

  it("034:FR-003: rows read with CRLF line endings too", () => {
    expect(parseGate(allMet().replace(/\n/g, "\r\n"))).toHaveLength(5);
  });
});

describe("the release check (034, US-2, US-4, US-6)", () => {
  it("034:FR-004: stops at the first condition that is not met and names it", () => {
    const gate = table([["C1", "met", "2026-12-01", "x"], ["C2", "pending", "", "T031"], ["C3", "not met", "2026-12-01", "no live runner"], ["C4", "met", "2026-12-01", "x"], ["C5", "met", "2026-12-01", "x"]]);
    const r = checkRelease({ version: "2.0.0", read: files({ [GATE_FILE]: gate }), npmView: published });
    expect(r.applies).toBe(true);
    expect(r.problems[0]).toBe("C2 (cond C2) is pending: T031");
    expect(r.problems[1]).toMatch(/^C3 .* is not met: no live runner/);
  });

  it("034:FR-004: everything met, plugin published and candidate recorded passes", () => {
    expect(checkRelease({ version: "2.0.0", read: files(), npmView: published })).toEqual({ applies: true, problems: [], warnings: [] });
  });

  it("034:FR-004: the plugin is a precondition, not a sixth condition (D-2): unticked 036 tasks and an unpublished package stop the release", () => {
    expect(pluginTaskProblems(tasks036(" "))).toHaveLength(3);
    expect(pluginTaskProblems(undefined)[0]).toMatch(/not found/);
    const r = checkRelease({ version: "2.0.0", read: files({ "036-tasks": tasks036(" ") }), npmView: () => ({ status: 1, stdout: "", stderr: "npm error code E404\nnpm error 404 Not Found" }) });
    expect(r.problems.filter((p: string) => p.startsWith("036 "))).toHaveLength(3);
    expect(r.problems).toContain("@ambystech/ambykit-emitter-antigravity is not published on npm (036 T034)");
  });

  it("034:FR-004: offline or an npm failure warns instead of guessing", () => {
    expect(checkRelease({ version: "2.0.0", read: files(), npmView: null }).warnings[0]).toMatch(/offline/);
    expect(npmViewOutcome({ status: null, stdout: "", stderr: "", error: new Error("ENOENT") }).warning).toMatch(/could not run npm/);
    expect(npmViewOutcome({ status: 1, stdout: "", stderr: "npm error code ETIMEDOUT" }).warning).toMatch(/ETIMEDOUT/);
  });

  it("034:FR-009: a final version needs a candidate report naming another project and a date", () => {
    expect(rcReportProblems(undefined)[0]).toMatch(/does not exist/);
    expect(rcReportProblems("- **Project:** AmbyKit\n- **Date:** 2026-12-02")[0]).toMatch(/other than this repository/);
    expect(rcReportProblems("- **Project:** ambystechcom/AmbyKit\n- **Date:** 2026-12-02")).toHaveLength(1);
    expect(rcReportProblems("- **Project:** acme\n")[0]).toMatch(/no date/);
    expect(rcReportProblems(rcReport)).toEqual([]);
    const r = checkRelease({ version: "2.0.0", read: files({ [RC_REPORT_FILE]: undefined }), npmView: published });
    expect(r.problems).toHaveLength(1);
  });

  it("034:FR-009: a release candidate and a 1.x version are not gated", () => {
    expect(gateApplies("2.0.0")).toBe(true);
    expect(gateApplies("2.0.3")).toBe(true);
    for (const v of ["2.0.0-rc.1", "1.6.1", "2.1.0", "nonsense"]) expect(gateApplies(v), v).toBe(false);
    expect(checkRelease({ version: "2.0.0-rc.1", read: () => undefined, npmView: null })).toEqual({ applies: false, problems: [], warnings: [] });
  });

  it("034:FR-004: npm run release:check exits non-zero today and names C1", () => {
    const r = spawnSync(process.execPath, [resolve(root, "scripts/release-gate.mjs"), "--version", "2.0.0", "--offline"], { encoding: "utf8", cwd: root });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/stops at: C1 \(AmbyKit's own specs are migrated to format v2\) is pending/);
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts["release:check"]).toBe("node scripts/release-gate.mjs --version 2.0.0");
  });
});

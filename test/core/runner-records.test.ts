import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RUNNERS, type RunnerSpec } from "../../src/core/runners.js";
import { runner } from "../helpers/runner-registry-fixture.js";

/**
 * Feature 033 (US-2, FR-004, SC-001, Principle 4): a runner is `verified: true` only with a recorded live check for every operating
 * system it lists, in `specs/033-stable-run-and-plugin-api/verification/<runner>-<os>.md`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECORDS = join(ROOT, "specs", "033-stable-run-and-plugin-api", "verification");
const OS_NAME: Partial<Record<NodeJS.Platform, string>> = { linux: "linux", darwin: "macos", win32: "windows" };
const FIELDS = ["Runner", "OS", "Assistant version", "Invocation", "Prompt delivery", "Exit behaviour", "Usage reported", "Checked by"];

/** What is wrong with a runner's claim to be verified, given the folder that should hold its records. Empty when it holds. */
function recordProblems(r: RunnerSpec, dir: string): string[] {
  if (!r.verified) return [];
  const problems: string[] = [];
  if (!r.verifiedOn || r.verifiedOn.length === 0) problems.push(`${r.id} is verified but lists no operating system in verifiedOn`);
  if (!r.verifiedRange) problems.push(`${r.id} is verified but has no verifiedRange`);
  if (!r.verifiedVersion) problems.push(`${r.id} is verified but has no verifiedVersion`);
  for (const os of r.verifiedOn ?? []) {
    const name = OS_NAME[os];
    if (!name) {
      problems.push(`${r.id} lists the platform '${os}', which has no record name`);
      continue;
    }
    const file = join(dir, `${r.id}-${name}.md`);
    if (!existsSync(file)) {
      problems.push(`${r.id} is verified on ${os} but ${r.id}-${name}.md does not exist`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const field of FIELDS) {
      const m = new RegExp("^\\s*[-*]\\s*\\*\\*" + field + ":\\*\\*[ \\t]*(.*)$", "mi").exec(text);
      if (!m || m[1]!.trim() === "") problems.push(`${r.id}-${name}.md records no '${field}'`);
    }
    if (r.verifiedVersion && !text.includes(r.verifiedVersion)) problems.push(`${r.id}-${name}.md does not mention the verified version ${r.verifiedVersion}`);
  }
  return problems;
}

function record(over: Partial<Record<string, string>> = {}): string {
  const values: Record<string, string> = {
    Runner: "alpha",
    OS: "linux",
    "Assistant version": "1.4.0",
    Invocation: "`alpha -p`",
    "Prompt delivery": "stdin",
    "Exit behaviour": "0 finished, 1 failed",
    "Usage reported": "no",
    "Checked by": "someone, 2026-11-20",
    ...over,
  };
  return `# alpha on linux\n\n${FIELDS.map((f) => `- **${f}:** ${values[f]}`).join("\n")}\n`;
}

describe("runner verification records (feature 033)", () => {
  it("033:FR-004, 033:SC-001: every runner marked verified in the registry has a complete record for each of its operating systems", () => {
    for (const r of RUNNERS) expect(recordProblems(r, RECORDS), r.id).toEqual([]);
  });

  it("033:FR-005: a runner with no record is not verified (the shipped registry has none verified until a person records it)", () => {
    const withoutRecord = RUNNERS.filter((r) => !r.verified).map((r) => r.id);
    const verified = RUNNERS.filter((r) => r.verified).map((r) => r.id);
    for (const id of verified) expect(existsSync(join(RECORDS, `${id}-linux.md`)) || existsSync(join(RECORDS, `${id}-macos.md`)) || existsSync(join(RECORDS, `${id}-windows.md`)), id).toBe(true);
    expect([...withoutRecord, ...verified].sort()).toEqual(RUNNERS.map((r) => r.id).sort());
  });

  it("033:FR-004: the check refuses a verified runner with no record, a missing OS, an empty field or a different version", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-records-"));
    const alpha = runner({ id: "alpha", verified: true, verifiedVersion: "1.4.0", verifiedOn: ["linux", "win32"], verifiedRange: ">=1.0.0 <2.0.0" });
    expect(recordProblems(alpha, dir).join("\n")).toContain("alpha-linux.md does not exist");

    writeFileSync(join(dir, "alpha-linux.md"), record());
    writeFileSync(join(dir, "alpha-windows.md"), record({ OS: "windows" }));
    expect(recordProblems(alpha, dir)).toEqual([]);

    writeFileSync(join(dir, "alpha-windows.md"), record({ Invocation: "" }));
    expect(recordProblems(alpha, dir)).toEqual(["alpha-windows.md records no 'Invocation'"]);

    writeFileSync(join(dir, "alpha-windows.md"), record({ "Assistant version": "9.9.9" }));
    expect(recordProblems(alpha, dir).join("\n")).toContain("does not mention the verified version 1.4.0");

    rmSync(join(dir, "alpha-windows.md"), { force: true });
    expect(recordProblems(alpha, dir).join("\n")).toContain("alpha-windows.md does not exist");
  });

  it("033:FR-004: a verified runner must list its operating systems, a range and a version", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-records-"));
    mkdirSync(dir, { recursive: true });
    const bare = runner({ id: "bare", verified: true });
    expect(recordProblems(bare, dir)).toEqual([
      "bare is verified but lists no operating system in verifiedOn",
      "bare is verified but has no verifiedRange",
      "bare is verified but has no verifiedVersion",
    ]);
  });

  it("033:FR-004: the record format is written down where a person recording one will look", () => {
    const readme = readFileSync(join(RECORDS, "README.md"), "utf8");
    for (const f of FIELDS) expect(readme, f).toContain(`**${f}:**`);
  });
});

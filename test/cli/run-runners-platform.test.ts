import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { gitProject } from "../helpers/git-repo.js";
import { runCommand } from "../helpers/run-command.js";
import { runner } from "../helpers/runner-registry-fixture.js";

/**
 * Feature 033 (US-2, FR-004, FR-005): `run --runners` and a refused lane say where and for which versions a runner was verified, and
 * that it is unverified on this platform when it does not match.
 */

const F = "028-ambykit-run";
// A platform no CI machine runs on, so the record never matches the machine running this test.
const ELSEWHERE = ["aix"] as NodeJS.Platform[];
const HERE = [process.platform] as NodeJS.Platform[];

describe("ambykit run --runners shows platforms and version ranges (feature 033)", () => {
  it("033:FR-004: a runner verified here is listed with its platforms and range, and is runnable", async () => {
    const registry = [runner({ id: "claude", verified: true, verifiedVersion: "1.4.0", verifiedOn: HERE, verifiedRange: ">=1.0.0 <2.0.0" })];
    const r = await runCommand(new RunCommand({ registry }), gitProject([F]), [], { runners: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain(`verified (1.4.0) on ${process.platform} for >=1.0.0 <2.0.0`);
    expect(r.out).toContain("runnable");
    expect(r.out).not.toContain("not runnable");
  });

  it("033:FR-004, 033:FR-005: a runner verified only elsewhere is listed as unverified on this platform and is not runnable", async () => {
    const registry = [runner({ id: "claude", verified: true, verifiedVersion: "1.4.0", verifiedOn: ELSEWHERE, verifiedRange: ">=1.0.0" })];
    const r = await runCommand(new RunCommand({ registry }), gitProject([F]), [], { runners: true });
    expect(r.out).toContain("on aix");
    expect(r.out).toContain("not runnable");
    expect(r.out).toContain("unverified on this platform");
    expect(r.out).toContain(process.platform);
  });

  it("033:FR-004, 033:FR-005: --json carries the platforms, the range and the reason", async () => {
    const registry = [runner({ id: "claude", verified: true, verifiedVersion: "1.4.0", verifiedOn: ELSEWHERE, verifiedRange: ">=1.0.0" })];
    const r = await runCommand(new RunCommand({ registry }), gitProject([F]), [], { runners: true, json: true });
    const rows = JSON.parse(r.out) as { verifiedOn: string[]; verifiedRange: string; runnable: boolean; reason: string }[];
    expect(rows[0]).toMatchObject({ verifiedOn: ["aix"], verifiedRange: ">=1.0.0", runnable: false });
    expect(rows[0]!.reason).toContain("unverified on this platform");
  });

  it("033:FR-004: a runner with no record keeps the 1.6 listing text exactly", async () => {
    const r = await runCommand(new RunCommand(), gitProject([F]), [], { runners: true });
    // the claude runner reports usage since its JSON result is read (live check); the listing format is unchanged
    expect(r.out).toMatch(/ {2}claude {2}Claude Code {2}unverified {2}usage reported {2}not runnable/);
    expect(r.out).toMatch(/ {2}codex {2}Codex {2}unverified {2}usage not reported {2}not runnable/);
    expect(r.out).not.toMatch(/verified[^\n]* on (linux|darwin|win32|aix)/);
  });
});

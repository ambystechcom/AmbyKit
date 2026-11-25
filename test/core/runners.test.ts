import { describe, expect, it } from "vitest";
import { RUNNERS, listRunners, runnable, runnerFor, type RunnerSpec } from "../../src/core/runners.js";

// A verified test runner with no platform or version restriction, so it is runnable on every OS the suite runs on.
const { verifiedOn: _on, verifiedRange: _range, ...base } = RUNNERS[0]!;
const verified: RunnerSpec = { ...base, id: "fake", label: "Fake", verified: true, verifiedVersion: "1.0.0" };

describe("headless runner registry (feature 028)", () => {
  it("028:FR-007: claude and codex are recorded, with exit behaviour and usage reporting", () => {
    expect(RUNNERS.map((r) => r.id)).toEqual(["claude", "codex"]);
    for (const r of RUNNERS) {
      expect(r.exit.length).toBeGreaterThan(0);
      expect(typeof r.reportsUsage).toBe("boolean");
      expect(r.invoke({ prompt: "p", promptFile: "f" }).exe).toBe(r.executable);
    }
  });

  it("028:SC-006: an unverified runner is refused; a verified one names where and for which versions it was checked", () => {
    for (const r of RUNNERS) {
      if (!r.verified) {
        expect(runnable(r.id).ok).toBe(false);
        continue;
      }
      // the live record itself is checked by test/core/runner-records.test.ts
      expect(r.verifiedVersion).toBeTruthy();
      expect(r.verifiedRange).toBeTruthy();
      expect(r.verifiedOn?.length).toBeGreaterThan(0);
      for (const platform of ["linux", "darwin", "win32"] as const) {
        expect(runnable(r.id, { platform }).ok).toBe(r.verifiedOn!.includes(platform));
      }
    }
    expect(RUNNERS.find((r) => r.id === "codex")!.verified).toBe(false);
  });

  it("028:FR-006: a refusal names the runner and what is still to confirm", () => {
    const can = runnable("codex");
    expect(can.ok).toBe(false);
    if (!can.ok) {
      expect(can.reason).toContain("Codex");
      expect(can.reason).toContain("not verified");
      expect(can.reason).toContain("docs/tool-compatibility.md");
    }
  });

  it("028:FR-006: an assistant with no runner at all is refused with the runnable list", () => {
    const can = runnable("cursor", [verified]);
    expect(can.ok).toBe(false);
    if (!can.ok) expect(can.reason).toContain("fake");
  });

  it("028:FR-007: a verified runner is runnable and listed with its version", () => {
    expect(runnable("fake", [verified]).ok).toBe(true);
    const rows = listRunners([verified, ...RUNNERS]);
    expect(rows[0]).toMatchObject({ id: "fake", verified: true, verifiedVersion: "1.0.0", runnable: true });
    const unverified = { ...RUNNERS[0]!, verified: false };
    const rows2 = listRunners([verified, unverified]);
    expect(rows2[1]).toMatchObject({ id: "claude", runnable: false });
    expect(rows2[1]!.reason).toBeTruthy();
    expect(rows[1]).toMatchObject({ id: "claude" });
  });

  it("028:FR-004: the prompt travels on stdin and the model is passed only when set", () => {
    const claude = runnerFor("claude")!;
    expect(claude.invoke({ prompt: "do it", promptFile: "x" }).stdin).toBe("do it");
    expect(claude.invoke({ prompt: "p", promptFile: "x" }).args).not.toContain("--model");
    expect(claude.invoke({ prompt: "p", promptFile: "x", model: "m" }).args).toContain("m");
  });

  it("028:FR-006: the claude command can edit and report headless, and ends with a JSON result (live check, Windows)", () => {
    const args = runnerFor("claude")!.invoke({ prompt: "p", promptFile: "x" }).args;
    expect(args[0]).toBe("-p");
    expect(args.slice(args.indexOf("--permission-mode"), args.indexOf("--permission-mode") + 2)).toEqual(["--permission-mode", "acceptEdits"]);
    // only ambykit itself is allowed as a shell command, on both shell tools (Bash, and PowerShell on Windows)
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Bash(ambykit:*),PowerShell(ambykit:*)");
    expect(args.slice(args.indexOf("--output-format"), args.indexOf("--output-format") + 2)).toEqual(["--output-format", "json"]);
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("bypassPermissions");
  });
});

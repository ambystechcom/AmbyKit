import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { FAST_FAILURE_SECONDS, isImmediateFailure } from "../../src/core/run-supervise.js";
import { gitProject } from "../helpers/git-repo.js";
import { fakeRegistry, unverifiedRegistry } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

describe("ambykit run --runners (feature 028)", () => {
  it("028:FR-007: lists claude and codex with their status and why they are not runnable", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, [], { runners: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("claude");
    expect(r.out).toContain("codex");
    expect(r.out).toContain("unverified");
    expect(r.out).toContain("not verified yet");
  });

  it("028:SC-006: with no verified runner the runnable list is empty", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand({ registry: unverifiedRegistry() }), root, [], { runners: true, json: true });
    const rows = JSON.parse(r.out) as { id: string; runnable: boolean }[];
    expect(rows.map((x) => x.id)).toEqual(["claude", "codex"]);
    expect(rows.some((x) => x.runnable)).toBe(false);
  });

  it("028:FR-007: a verified runner is shown runnable with its version and usage capability", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(["claude"], true) }), root, [], { runners: true, json: true });
    const rows = JSON.parse(r.out);
    expect(rows[0]).toMatchObject({ id: "claude", verified: true, verifiedVersion: "fake", reportsUsage: true, runnable: true });
  });

  it("028:FR-006: the list needs no feature and writes nothing", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, [], { runners: true });
    expect(r.err).toBe("");
  });

  it("028:FR-006: a runner that dies at once with an error is a command mismatch; a late failure is not", () => {
    expect(isImmediateFailure({ code: 1, ranMs: 2000 })).toBe(true);
    expect(isImmediateFailure({ code: null, ranMs: 100 })).toBe(true);
    expect(isImmediateFailure({ code: 0, ranMs: 100 })).toBe(false);
    expect(isImmediateFailure({ code: 1, ranMs: (FAST_FAILURE_SECONDS + 1) * 1000 })).toBe(false);
  });
});

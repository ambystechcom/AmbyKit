import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ActivityCommand } from "../../src/cli/activity.js";
import { readMarkers } from "../../src/core/activity.js";
import { TARGETS } from "../../src/emitters/index.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";

/** `ambykit activity` (feature 017, US-3: FR-018/FR-019, SC-004). It never fails the agent. */

async function run(cwd: string, positionals: string[], flags: Record<string, string | boolean>) {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => void warnings.push(a.join(" "));
  try {
    const code = await new ActivityCommand().run({ cwd, positionals, flags });
    return { code, warnings: warnings.join("\n") };
  } finally {
    console.warn = orig;
  }
}

describe("ambykit activity (feature 017)", () => {
  it("round-trips a marker for every tool id (SC-004)", async () => {
    const root = dashboardFixture();
    const feature = "001-core";
    for (const t of TARGETS) {
      const { code } = await run(root, ["001"], { agent: t.id, phase: "plan" });
      expect(code, t.id).toBe(0);
    }
    const markers = readMarkers(root);
    expect(markers.map((m) => m.agent).sort()).toEqual(TARGETS.map((t) => t.id).sort());
    expect(markers.every((m) => m.feature === feature && m.phase === "plan")).toBe(true);
  });

  it("records the task and resolves the full directory name too", async () => {
    const root = dashboardFixture();
    await run(root, ["001-core"], { agent: "claude", phase: "implement", task: "T014" });
    const [m] = readMarkers(root);
    expect(m).toMatchObject({ feature: "001-core", agent: "claude", phase: "implement", task: "T014" });
    expect(Date.parse(m!.at)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("keeps markers out of git with a self-ignoring directory (FR-019)", async () => {
    const root = dashboardFixture();
    await run(root, ["001"], { agent: "codex", phase: "tasks" });
    expect(readFileSync(join(root, ".amby", "activity", ".gitignore"), "utf8")).toMatch(/^\*$/m);
    expect(existsSync(join(root, ".gitignore"))).toBe(false); // the project's own file is untouched
  });

  it("warns and exits 0 for an unknown feature, missing flags, a bad id, or no project", async () => {
    const root = dashboardFixture();
    for (const [pos, flags, why] of [
      [["999"], { agent: "claude", phase: "plan" }, "feature '999' not found"],
      [["001"], { phase: "plan" }, "usage"],
      [["001"], { agent: "../x", phase: "plan" }, "invalid agent id"],
    ] as const) {
      const r = await run(root, [...pos], flags);
      expect(r.code).toBe(0);
      expect(r.warnings).toContain(why);
    }
    expect(readMarkers(root)).toEqual([]);
    const outside = await run(mkdtempSync(join(tmpdir(), "ambykit-noproj-")), ["001"], { agent: "claude", phase: "plan" });
    expect(outside.code).toBe(0);
    expect(outside.warnings).toContain("not inside an AmbyKit project");
  });
});

describe("ambykit activity: lane, state and run flags (feature 025, FR-021)", () => {
  it("025:FR-021: --lane names the marker file and --state/--run land in the body", async () => {
    const root = dashboardFixture();
    const { code } = await run(root, ["001"], { agent: "claude", phase: "implement", lane: "1-2", state: "blocked", task: "T003" });
    expect(code).toBe(0);
    const [m] = readMarkers(root);
    expect(m).toMatchObject({ agent: "claude", lane: "001-core.lane-1-2", state: "blocked", task: "T003" });
    expect(existsSync(join(root, ".amby", "activity", "001-core.claude~lane-1-2.json"))).toBe(true);
  });

  it("025:FR-021: invocations without the new flags write exactly today's marker", async () => {
    const root = dashboardFixture();
    await run(root, ["001"], { agent: "claude", phase: "plan", task: "T001" });
    const body = JSON.parse(readFileSync(join(root, ".amby", "activity", "001-core.claude.json"), "utf8"));
    expect(Object.keys(body)).toEqual(["agent", "phase", "task", "at", "pid"]);
  });

  it("025:FR-021: a bad --state warns, exits 0 and writes nothing", async () => {
    const root = dashboardFixture();
    const r = await run(root, ["001"], { agent: "claude", phase: "plan", state: "sleeping" });
    expect(r.code).toBe(0);
    expect(r.warnings).toMatch(/invalid state/);
    expect(readMarkers(root)).toEqual([]);
  });

  it("025:FR-012: with no run to resolve it still exits 0, warning", async () => {
    const root = dashboardFixture();
    const r = await run(root, ["001"], { agent: "claude", phase: "plan", lane: "1-1", state: "working" });
    expect(r.code).toBe(0);
    expect(r.warnings).toMatch(/no unfinished run/);
    expect(readMarkers(root)).toHaveLength(1);
  });
});

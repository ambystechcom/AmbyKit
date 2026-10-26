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

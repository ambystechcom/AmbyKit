import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckCommand } from "../src/cli/check.js";
import { SyncCommand } from "../src/cli/sync.js";
import { buildEmittedFiles } from "../src/core/emit.js";
import { emitFiles } from "./helpers/emit-target.js";
import { runCommand } from "./helpers/run-command.js";

/** Antigravity sharing `.agents/skills/` with Codex and Pi (feature 018, US-3). */

const SPECIFY = ".agents/skills/amby-specify/SKILL.md";
const contents = (tools: string[]): string => emitFiles(tools).find((f) => f.path === SPECIFY)!.contents;

function project(tools: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-shared-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools, manageRules: false }));
  return root;
}

describe("shared skills output", () => {
  it.each([
    [["antigravity", "codex"]],
    [["codex", "antigravity"]],
    [["antigravity-cli", "pi", "antigravity", "codex"]],
  ])("writes each skill once, reporting codex's id (%j)", (tools) => {
    const paths = emitFiles(tools).map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(contents(tools)).toContain("--agent=codex");
  });

  it("reports the IDE id when the CLI target is also selected, in either order", () => {
    for (const tools of [["antigravity", "antigravity-cli"], ["antigravity-cli", "antigravity"]]) {
      expect(contents(tools)).toContain("--agent=antigravity ");
    }
  });

  it("is complete: Antigravity plus Codex emits exactly the phase skills", () => {
    const both = emitFiles(["antigravity", "codex"], { manageRules: false }).map((f) => f.path).sort();
    const codex = emitFiles(["codex"], { manageRules: false }).map((f) => f.path).sort();
    expect(both).toEqual(codex);
  });

  it("does not throw for Antigravity next to any other skills-based target", () => {
    expect(() => emitFiles(["antigravity", "codex", "pi", "kiro", "copilot-cli"])).not.toThrow();
  });

  it("keeps the skills when Antigravity is deselected and Codex stays", async () => {
    const root = project(["antigravity", "codex"]);
    await runCommand(new SyncCommand(), root, []);
    writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["codex"], manageRules: false }));
    const files = buildEmittedFiles(root, { version: "0.0.0", tools: ["codex"], manageRules: false });
    expect(files.some((f) => f.path === SPECIFY)).toBe(true);
    expect(existsSync(join(root, SPECIFY))).toBe(true);
  });

  it("check names every owner of .agents/skills/", async () => {
    const root = project(["antigravity", "antigravity-cli", "codex", "pi"]);
    await runCommand(new SyncCommand(), root, []);
    const r = await runCommand(new CheckCommand(), root, []);
    const text = r.out + r.err;
    expect(text).toMatch(/\.agents\/skills\/ is owned by: antigravity, antigravity-cli, codex, pi/);
  });
});

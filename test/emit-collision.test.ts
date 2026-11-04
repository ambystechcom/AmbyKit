import { afterEach, describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import type { CommandSpec, CommandSurface, EmittedFile } from "../src/core/types.js";
import { BaseEmitter, TARGETS } from "../src/emitters/index.js";
import { emitFiles, tempProject } from "./helpers/emit-target.js";

/** Shared-output guard (feature 016, FR-007). */

class Clash extends BaseEmitter {
  readonly toolId = "clash";
  readonly displayName = "Clash";
  readonly commandSurface: CommandSurface = "skills";
  readonly commandDir = ".agents/skills";
  protected override commandFrontmatter(): Array<[string, string]> {
    return [];
  }
  protected override commandFile(spec: CommandSpec): EmittedFile {
    return { path: `.agents/skills/${spec.name.replace(/\./g, "-")}/SKILL.md`, contents: "different\n", scope: "project" };
  }
}

describe("emit collision guard", () => {
  afterEach(() => {
    const i = TARGETS.findIndex((t) => t.id === "clash");
    if (i >= 0) TARGETS.splice(i, 1);
  });

  it("writes identical shared output once", () => {
    const files = emitFiles(["copilot", "copilot-cli"]);
    const paths = files.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain(".github/copilot-instructions.md");
  });

  it("throws, naming both tool ids, when one path gets different contents", () => {
    TARGETS.push({ id: "clash", displayName: "Clash", emitter: new Clash() });
    expect(() =>
      buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["codex", "clash"], manageRules: true }),
    ).toThrow(/\.agents\/skills\/amby-.*'codex' and 'clash'/);
  });

  it("is not triggered by targets with disjoint output", () => {
    expect(() => emitFiles(["codex", "antigravity", "claude"])).not.toThrow();
  });
});

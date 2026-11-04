import { afterEach, describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import type { CommandSpec, CommandSurface, EmittedFile } from "../src/core/types.js";
import { BaseEmitter, TARGETS } from "../src/emitters/index.js";
import { CodexEmitter } from "../src/emitters/codex.js";
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

/** A Codex-shaped emitter with another id: identical output except `--agent=<id>`. */
class Twin extends CodexEmitter {
  constructor(id: string) {
    super();
    Object.defineProperty(this, "toolId", { value: id }); // CodexEmitter's field is an own property
  }
}

describe("emit collision guard", () => {
  afterEach(() => {
    for (const id of ["clash", "t-ag", "t-cli", "t-a", "t-b"]) {
      const i = TARGETS.findIndex((t) => t.id === id);
      if (i >= 0) TARGETS.splice(i, 1);
    }
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

  it("keeps the higher-ranked id when targets differ only in the self-report id, in any order", () => {
    // Feature 018 FR-010: codex > antigravity > antigravity-cli, independent of config order.
    const ids = { codex: new CodexEmitter(), antigravity: new Twin("antigravity"), "antigravity-cli": new Twin("antigravity-cli") };
    TARGETS.push(
      { id: "t-ag", displayName: "T AG", emitter: ids.antigravity },
      { id: "t-cli", displayName: "T CLI", emitter: ids["antigravity-cli"] },
    );
    const spec = ".agents/skills/amby-specify/SKILL.md";
    const pick = (tools: string[]) => emitFiles(tools).find((f) => f.path === spec)!.contents;
    for (const order of [["codex", "t-ag", "t-cli"], ["t-cli", "t-ag", "codex"], ["t-ag", "codex"]]) {
      expect(pick(order)).toContain("--agent=codex");
    }
    for (const order of [["t-ag", "t-cli"], ["t-cli", "t-ag"]]) {
      expect(pick(order)).toContain("--agent=antigravity ");
      expect(pick(order)).not.toContain("--agent=antigravity-cli");
    }
    TARGETS.splice(TARGETS.findIndex((t) => t.id === "t-ag"), 1);
    TARGETS.splice(TARGETS.findIndex((t) => t.id === "t-cli"), 1);
  });

  it("keeps last-writer-wins for ids outside the priority list", () => {
    TARGETS.push({ id: "t-a", displayName: "A", emitter: new Twin("zeta") }, { id: "t-b", displayName: "B", emitter: new Twin("eta") });
    const pick = (tools: string[]) => emitFiles(tools).find((f) => f.path === ".agents/skills/amby-specify/SKILL.md")!.contents;
    expect(pick(["t-a", "t-b"])).toContain("--agent=eta");
    expect(pick(["t-b", "t-a"])).toContain("--agent=zeta");
    TARGETS.splice(TARGETS.findIndex((t) => t.id === "t-a"), 1);
    TARGETS.splice(TARGETS.findIndex((t) => t.id === "t-b"), 1);
  });

  it("still throws when a ranked pair differs by more than the self-report id", () => {
    TARGETS.push({ id: "clash", displayName: "Clash", emitter: new Clash() });
    expect(() =>
      buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["codex", "clash"], manageRules: true }),
    ).toThrow(/'codex' and 'clash'/);
  });

  it("is not triggered by targets with disjoint output", () => {
    expect(() => emitFiles(["codex", "antigravity", "claude"])).not.toThrow();
  });
});

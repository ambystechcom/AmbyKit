import { describe, expect, it } from "vitest";
import { ClaudeEmitter } from "../src/emitters/claude.js";
import { CopilotEmitter } from "../src/emitters/copilot.js";
import { CursorEmitter } from "../src/emitters/cursor.js";
import { REGION_HEADING, findRegion } from "../src/core/merge.js";
import type { CommandSpec, EmittedFile, RulesContext } from "../src/core/types.js";

const spec: CommandSpec = {
  id: "specify",
  name: "amby.specify",
  description: "Turn a feature idea into a spec.",
  argumentHint: "<feature description>",
  phase: "specify",
  reads: [],
  writes: [],
  allowedTools: ["read", "write", "edit"],
  body: "Write a specification.",
};
const ctx: RulesContext = { projectName: "demo", specs: [spec], manageRules: true };

/** The rules file an emitter produces (path uses OS separators, so match by basename). */
function rulesFile(files: EmittedFile[], basename: string): EmittedFile {
  const f = files.find((x) => x.path.endsWith(basename));
  expect(f, `expected a rules file ending in ${basename}`).toBeDefined();
  return f!;
}

describe("region-based rules files (feature 008 / FR-003, FR-006)", () => {
  it("Claude CLAUDE.md is a region file with the @AGENTS.md bridge as required prefix (FR-011)", () => {
    const file = rulesFile(new ClaudeEmitter().emit([spec], ctx), "CLAUDE.md");
    expect(file.merge).toBe("region");
    expect(file.requiredPrefix).toBe("@AGENTS.md");
    expect(file.contents.startsWith("@AGENTS.md")).toBe(true);
    expect(findRegion(file.contents)).not.toBeNull();
  });

  it("Copilot instructions are a region file with a single region", () => {
    const file = rulesFile(new CopilotEmitter().emit([spec], ctx), "copilot-instructions.md");
    expect(file.merge).toBe("region");
    expect(file.contents).toContain(REGION_HEADING);
    expect(() => findRegion(file.contents)).not.toThrow();
  });

  it("Cursor .mdc keeps its frontmatter and carries the region in the body", () => {
    const file = rulesFile(new CursorEmitter().emit([spec], ctx), "ambykit.mdc");
    expect(file.merge).toBe("region");
    expect(file.contents).toContain("alwaysApply: true"); // frontmatter preserved
    expect(findRegion(file.contents)).not.toBeNull();
  });

  it("every region file carries a fingerprint footer so hand-edits are detectable (FR-008a)", () => {
    for (const emitter of [new ClaudeEmitter(), new CopilotEmitter(), new CursorEmitter()]) {
      const file = emitter.emit([spec], ctx).find((f) => f.merge === "region")!;
      expect(findRegion(file.contents)!.fingerprint).not.toBeNull();
    }
  });
});

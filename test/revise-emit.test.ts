import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { ClaudeEmitter } from "../src/emitters/claude.js";
import { CursorEmitter } from "../src/emitters/cursor.js";
import type { RulesContext } from "../src/core/types.js";

// Feature 009: /amby.revise is a neutral prompt that loads as a CommandSpec and emits per tool (FR-006).
describe("revise command (feature 009)", () => {
  const specs = loadCommandSpecs();
  const revise = specs.find((s) => s.id === "revise");

  it("loads as a CommandSpec named amby.revise in the revise phase", () => {
    expect(revise, "src/prompts/revise.md should load").toBeDefined();
    expect(revise!.name).toBe("amby.revise");
    expect(revise!.phase).toBe("revise");
    // Continues spec + design in place → edits existing files, no fresh-file write needed.
    expect(revise!.allowedTools).toEqual(["read", "edit"]);
  });

  it("is emitted as a command file by every tool with a command surface (FR-006)", () => {
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    for (const emitter of [new ClaudeEmitter(), new CursorEmitter()]) {
      const files = emitter.emit(specs, ctx);
      expect(files.some((f) => f.path.endsWith("amby.revise.md"))).toBe(true);
    }
  });
});

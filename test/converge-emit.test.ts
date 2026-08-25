import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import {
  AntigravityCliEmitter,
  AntigravityEmitter,
  ClaudeEmitter,
  CodexEmitter,
  CopilotCliEmitter,
  CopilotEmitter,
  CursorCliEmitter,
  CursorEmitter,
  OpenCodeEmitter,
} from "../src/emitters/index.js";
import type { RulesContext } from "../src/core/types.js";

// Feature 011: /amby.converge is a neutral prompt emitted per tool (FR-010) that may only touch the
// feature's tasks.md / spec.md — no write/bash tools, so it cannot edit code (FR-006, SC-003).
describe("converge command (feature 011)", () => {
  const specs = loadCommandSpecs();
  const converge = specs.find((s) => s.id === "converge");

  it("loads as a CommandSpec named amby.converge in the converge phase", () => {
    expect(converge, "src/prompts/converge.md should load").toBeDefined();
    expect(converge!.name).toBe("amby.converge");
    expect(converge!.phase).toBe("converge");
    expect(converge!.allowedTools).toEqual(["read", "edit"]);
    expect(converge!.writes).toEqual(["specs/NNN-slug/tasks.md", "specs/NNN-slug/spec.md"]);
  });

  it("is emitted by every tool with a command surface (SC-004)", () => {
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    const emitters = [
      new ClaudeEmitter(),
      new CopilotEmitter(),
      new CopilotCliEmitter(),
      new OpenCodeEmitter(),
      new CursorEmitter(),
      new CursorCliEmitter(),
      new AntigravityEmitter(),
      new AntigravityCliEmitter(),
      new CodexEmitter(),
    ];
    for (const emitter of emitters) {
      const files = emitter.emit(specs, ctx);
      const has = files.some((f) => /converge/.test(f.path));
      expect(has, `${emitter.constructor.name} (surface: ${emitter.commandSurface})`).toBe(
        emitter.commandSurface !== "none",
      );
    }
  });
});

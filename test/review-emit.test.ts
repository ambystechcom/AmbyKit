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

// Feature 013 / US-3: /amby.review is a neutral, read-only-by-default phase emitted per tool.
describe("review command (feature 013)", () => {
  const specs = loadCommandSpecs();
  const review = specs.find((s) => s.id === "review");

  it("loads as amby.review with no default role and no writes (FR-006)", () => {
    expect(review).toBeDefined();
    expect(review!.name).toBe("amby.review");
    expect(review!.phase).toBe("review");
    expect(review!.role).toBeUndefined(); // the reviewer is chosen per artifact / --as, not bound
    expect(review!.writes).toEqual([]);
    expect(review!.allowedTools).toEqual(["read", "edit"]);
    expect(review!.body).toContain("--apply");
    expect(review!.body).toContain("## Reviews");
  });

  it("is emitted by every tool with a command surface", () => {
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    for (const emitter of [
      new ClaudeEmitter(),
      new CopilotEmitter(),
      new CopilotCliEmitter(),
      new OpenCodeEmitter(),
      new CursorEmitter(),
      new CursorCliEmitter(),
      new AntigravityEmitter(),
      new AntigravityCliEmitter(),
      new CodexEmitter(),
    ]) {
      const has = emitter.emit(specs, ctx).some((f) => /review/.test(f.path));
      expect(has, emitter.constructor.name).toBe(emitter.commandSurface !== "none");
    }
  });
});

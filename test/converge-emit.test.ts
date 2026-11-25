import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import {
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

  // Feature 024 (FR-015, FR-016, FR-021): converge starts from the trace matrix, authored once.
  it("024:FR-015: starts from the trace matrix and cites gaps by qualified id", () => {
    expect(converge!.body).toMatch(/run `ambykit trace <feature> --json`/);
    expect(converge!.body).toContain("do not re-derive coverage");
    expect(converge!.body).toContain("(closes NNN:FR-###)");
  });

  it("024:FR-016: works as today when trace cannot run", () => {
    expect(converge!.body).toContain("if it fails, go on as without it");
  });

  it("024:FR-021: Claude grants converge only the scoped trace and activity verbs, no wider shell", () => {
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    const file = new ClaudeEmitter().emit(specs, ctx).find((f) => f.path.endsWith("amby.converge.md"))!;
    const tools = /allowed-tools: (.*)/.exec(file.contents)![1]!;
    expect(tools).toContain("Bash(ambykit trace:*)");
    expect(tools.split(", ").filter((t) => t === "Bash")).toEqual([]);
  });
});

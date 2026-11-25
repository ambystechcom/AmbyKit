import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { buildAmbyRegion } from "../src/core/rules.js";
import { wordCount } from "../src/core/roles.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Feature 022: /amby.decide is a neutral phase, callable from anywhere, emitted per tool.
describe("decide command (feature 022)", () => {
  const specs = loadCommandSpecs();
  const decide = specs.find((s) => s.id === "decide");

  it("loads as amby.decide with no bound role (FR-008)", () => {
    expect(decide).toBeDefined();
    expect(decide!.name).toBe("amby.decide");
    expect(decide!.phase).toBe("decide");
    expect(decide!.role).toBeUndefined();
  });

  it("writes only under .amby/decisions/ (FR-001, FR-006)", () => {
    expect(decide!.writes.length).toBeGreaterThan(0);
    for (const w of decide!.writes) expect(w.startsWith(".amby/decisions/")).toBe(true);
  });

  it("covers the numbering, duplicate, index, conflict and supersede rules (FR-003..FR-013)", () => {
    const body = decide!.body;
    expect(body).toContain("ask");
    expect(body).toContain("do not duplicate");
    expect(body).toContain("tombstones");
    expect(body).toContain("Never reuse");
    expect(body).toContain("--supersede ADR-###"); // FR-010
    expect(body).toContain("superseded-by");
    expect(body).toContain("Both sides");
    expect(body).toContain("wording-only"); // FR-011
    expect(body).toContain("status: proposed"); // FR-013
    expect(body).toContain("conflicts");
    expect(body).toContain("ambykit activity");
  });

  it("keeps the prompt body within its word budget and the template within its line cap (FR-017, SC-001)", () => {
    expect(wordCount(decide!.body)).toBeLessThanOrEqual(400);
    const template = readFileSync(join(import.meta.dirname, "..", "src", "templates", "adr.md"), "utf8");
    expect(template.split(/\r?\n/).length).toBeLessThanOrEqual(40);
  });

  it("is emitted by every tool with a command surface (FR-016, US-7)", () => {
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    for (const emitter of [
      new ClaudeEmitter(),
      new CopilotEmitter(),
      new CopilotCliEmitter(),
      new OpenCodeEmitter(),
      new CursorEmitter(),
      new CursorCliEmitter(),
      new CodexEmitter(),
    ]) {
      const has = emitter.emit(specs, ctx).some((f) => /decide/.test(f.path));
      expect(has, emitter.constructor.name).toBe(emitter.commandSurface !== "none");
    }
  });

  it("adds one agent-rules bullet that tells every phase to cite by ID and load only cited records (FR-008, FR-009)", () => {
    const region = buildAmbyRegion(specs);
    expect(region).toContain("/amby.decide");
    expect(region).toContain(".amby/decisions/");
    expect(region).toMatch(/Cite them as `ADR-###`; load only the cited records plus the index/);
    expect(region.match(/ADR-###/g)).toHaveLength(1);
  });
});

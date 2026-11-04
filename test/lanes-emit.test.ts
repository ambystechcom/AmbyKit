import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { buildAmbyRegion } from "../src/core/rules.js";
import { ClaudeEmitter } from "../src/emitters/index.js";
import type { RulesContext } from "../src/core/types.js";

// Feature 015: the path convention is authored once in the neutral prompts and emitted per tool.
describe("lane prompts (feature 015)", () => {
  const specs = loadCommandSpecs();
  const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
  const emitted = (id: string): string => {
    const spec = specs.find((s) => s.id === id)!;
    return new ClaudeEmitter().emit([spec], ctx)[0]!.contents;
  };

  it("tasks command asks for comma-separated paths and [P] only without overlap (FR-003)", () => {
    const body = emitted("tasks");
    expect(body).toContain("last parenthesized group");
    expect(body).toContain("comma-separated");
    expect(body).toContain("no globs");
    expect(body).toContain("Mark `[P]` only when no other task in the");
  });
});

describe("lane scope in implement and rules (feature 015, FR-018)", () => {
  it("implement command scopes work to the lane manifest", () => {
    const specs = loadCommandSpecs();
    const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
    const body = new ClaudeEmitter().emit([specs.find((s) => s.id === "implement")!], ctx)[0]!.contents;
    expect(body).toContain(".amby/lane/lane.json");
    expect(body.replace(/\s+/g, " ")).toContain("work only the task ids it lists");
  });

  it("the rules region maps a lane directory to its feature", () => {
    const region = buildAmbyRegion(loadCommandSpecs());
    expect(region).toContain(".worktrees/NNN-slug.lane-P-K/");
    expect(region).toContain("belongs to `NNN-slug`");
  });
});

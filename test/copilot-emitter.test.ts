import { describe, expect, it } from "vitest";
import { CopilotEmitter } from "../src/emitters/copilot.js";
import { CopilotCliEmitter } from "../src/emitters/copilot-cli.js";
import type { CommandSpec, RulesContext } from "../src/core/types.js";

const spec: CommandSpec = {
  id: "specify",
  name: "amby.specify",
  description: "Turn a feature idea into a spec.",
  argumentHint: "<feature description>",
  phase: "specify",
  reads: [],
  writes: [],
  allowedTools: ["read", "write", "edit"],
  body: "Write a specification for: **$ARGUMENTS**",
};

const ctx = (manageRules: boolean): RulesContext => ({
  projectName: "demo",
  specs: [spec],
  manageRules,
});

describe("CopilotEmitter (VS Code, commands surface)", () => {
  it("emits a prompt file at .github/prompts/<name>.prompt.md", () => {
    const files = new CopilotEmitter().emit([spec], ctx(false));
    const prompt = files.find((f) => f.path.endsWith(".prompt.md"));
    expect(prompt).toBeDefined();
    expect(prompt!.path).toBe(".github/prompts/amby.specify.prompt.md");
    expect(prompt!.contents).toContain('description: "Turn a feature idea into a spec."');
    expect(prompt!.contents).toContain("agent: agent");
  });

  it("translates $ARGUMENTS to Copilot's ${input:args}", () => {
    const prompt = new CopilotEmitter().emit([spec], ctx(false))[0]!;
    expect(prompt.contents).toContain("Write a specification for: **${input:args}**");
    expect(prompt.contents).not.toContain("$ARGUMENTS");
  });

  it("emits copilot-instructions.md only when rules are managed", () => {
    const withRules = new CopilotEmitter().emit([spec], ctx(true));
    expect(withRules.find((f) => f.path === ".github/copilot-instructions.md")).toBeDefined();
    const without = new CopilotEmitter().emit([spec], ctx(false));
    expect(without.find((f) => f.path === ".github/copilot-instructions.md")).toBeUndefined();
  });
});

describe("CopilotCliEmitter (skills surface)", () => {
  it("emits a SKILL.md per phase under .github/skills/amby-<id>/", () => {
    const files = new CopilotCliEmitter().emit([spec], ctx(false));
    const skill = files.find((f) => f.path.endsWith("SKILL.md"));
    expect(skill).toBeDefined();
    expect(skill!.path).toBe(".github/skills/amby-specify/SKILL.md");
    expect(skill!.contents).toContain("name: amby-specify");
    expect(skill!.contents).toContain('description: "Turn a feature idea into a spec."');
  });

  it("reuses Copilot's body transform and rules", () => {
    const files = new CopilotCliEmitter().emit([spec], ctx(true));
    const skill = files.find((f) => f.path.endsWith("SKILL.md"))!;
    expect(skill.contents).toContain("${input:args}");
    expect(files.find((f) => f.path === ".github/copilot-instructions.md")).toBeDefined();
  });
});

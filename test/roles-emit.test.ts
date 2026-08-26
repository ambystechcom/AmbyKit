import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { buildEmittedFiles } from "../src/core/emit.js";
import { installArtifactTemplates } from "../src/core/scaffold.js";
import { loadRoles } from "../src/core/roles.js";
import {
  AntigravityEmitter,
  ClaudeEmitter,
  CodexEmitter,
  CopilotCliEmitter,
  CopilotEmitter,
  CursorEmitter,
  OpenCodeEmitter,
} from "../src/emitters/index.js";
import type { RulesContext } from "../src/core/types.js";

// Feature 013: phases act as a role referenced by path; nothing changes without `.amby/roles/`.
describe("role binding on emitted commands (feature 013, US-1)", () => {
  const specs = loadCommandSpecs();
  const noRoles: RulesContext = { projectName: "demo", specs, manageRules: false };

  it("maps every phase except constitution to its default role (FR-002, FR-003)", () => {
    const byId = Object.fromEntries(specs.map((s) => [s.id, s.role]));
    expect(byId).toEqual({
      analyze: "qa",
      clarify: "pm",
      constitution: undefined,
      converge: "qa",
      design: "ux",
      implement: "developer",
      plan: "architect",
      revise: "pm",
      specify: "pm",
      tasks: "tech-lead",
    });
  });

  it("emits byte-identical commands when no roles are installed (FR-004, SC-001)", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-noroles-"));
    mkdirSync(join(root, ".amby"), { recursive: true });
    const files = buildEmittedFiles(root, { version: "0.0.0", tools: ["claude"], manageRules: false });
    const direct = new ClaudeEmitter().emit(specs, noRoles);
    expect(files.map((f) => f.contents)).toEqual(direct.map((f) => f.contents));
    for (const f of files) expect(f.contents).not.toContain("say so in your first line");
  });

  it("prepends the role line on every roled command for every command-surface emitter (FR-003)", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-roles-"));
    mkdirSync(join(root, ".amby"), { recursive: true });
    installArtifactTemplates(root);
    const ctx: RulesContext = { ...noRoles, roles: loadRoles(root) };
    const emitters = [
      new ClaudeEmitter(),
      new CopilotEmitter(),
      new CopilotCliEmitter(),
      new OpenCodeEmitter(),
      new CursorEmitter(),
      new AntigravityEmitter(),
      new CodexEmitter(),
    ];
    for (const emitter of emitters) {
      const files = emitter.emit(specs, ctx);
      for (const spec of specs) {
        const file = files.find((f) => f.path.includes(spec.id) || f.path.includes(spec.name));
        expect(file, `${emitter.constructor.name} ${spec.id}`).toBeDefined();
        if (spec.role) {
          expect(file!.contents).toContain(`@.amby/roles/${spec.role}.md`);
          expect(file!.contents).toContain("--as <id>");
          // The line precedes the original body (compare against its last line: placeholder-free).
          const tail = spec.body.trim().split("\n").at(-1)!.slice(0, 20);
          expect(file!.contents.indexOf("@.amby/roles/")).toBeLessThan(file!.contents.indexOf(tail));
        } else {
          expect(file!.contents).not.toContain("say so in your first line");
        }
      }
    }
  });

  it("names the role and, for Copilot, rewrites the placeholder inside the role line too", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-roles2-"));
    mkdirSync(join(root, ".amby"), { recursive: true });
    installArtifactTemplates(root);
    const ctx: RulesContext = { ...noRoles, roles: loadRoles(root) };
    const claude = new ClaudeEmitter().emit(specs, ctx).find((f) => f.path.endsWith("amby.plan.md"))!;
    expect(claude.contents).toContain("Act as the **Architect** in `@.amby/roles/architect.md`");
    const copilot = new CopilotEmitter().emit(specs, ctx).find((f) => f.path.includes("plan"))!;
    expect(copilot.contents).not.toMatch(/\$ARGUMENTS/);
  });
});

describe("native persona files (feature 013, US-5, FR-009)", () => {
  const specs = loadCommandSpecs();
  const root = mkdtempSync(join(tmpdir(), "ambykit-personas-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  installArtifactTemplates(root);
  const ctx: RulesContext = { projectName: "demo", specs, manageRules: false, roles: loadRoles(root) };

  it("emits one persona per role for the verified targets only", () => {
    const expectPersonas = (files: { path: string }[], prefix: string, suffix: string) => {
      const personas = files.filter((f) => f.path.startsWith(prefix)).map((f) => f.path).sort();
      expect(personas).toEqual(
        ["architect", "developer", "pm", "qa", "tech-lead", "ux"].map((id) => `${prefix}amby-${id}${suffix}`),
      );
    };
    expectPersonas(new ClaudeEmitter().emit(specs, ctx), ".claude/agents/", ".md");
    expectPersonas(new OpenCodeEmitter().emit(specs, ctx), ".opencode/agents/", ".md");
    expectPersonas(new CopilotEmitter().emit(specs, ctx), ".github/agents/", ".agent.md");
    expectPersonas(new CopilotCliEmitter().emit(specs, ctx), ".github/agents/", ".agent.md");
    for (const emitter of [new CursorEmitter(), new AntigravityEmitter(), new CodexEmitter()]) {
      expect(emitter.emit(specs, ctx).some((f) => /agents\/amby-/.test(f.path)), emitter.constructor.name).toBe(false);
    }
  });

  it("uses the verified frontmatter per target and the role body as the system prompt", () => {
    const claude = new ClaudeEmitter().emit(specs, ctx).find((f) => f.path.endsWith("amby-qa.md"))!;
    expect(claude.contents).toMatch(/^---\nname: amby-qa\ndescription: "QA Engineer/);
    expect(claude.contents).toContain("tools: Read, Grep, Glob");
    expect(claude.contents).toContain("Own verification.");
    expect(claude.contents).toContain("`AGENTS.md`");
    const opencode = new OpenCodeEmitter().emit(specs, ctx).find((f) => f.path.endsWith("amby-qa.md"))!;
    expect(opencode.contents).toMatch(/^---\ndescription: "QA Engineer[^\n]*\nmode: subagent\n---/);
    const copilot = new CopilotEmitter().emit(specs, ctx).find((f) => f.path.endsWith("amby-qa.agent.md"))!;
    expect(copilot.contents).toMatch(/^---\nname: amby-qa\ndescription: "QA Engineer/);
  });

  it("emits no persona files when roles are not installed (FR-004)", () => {
    const none: RulesContext = { projectName: "demo", specs, manageRules: true };
    expect(new ClaudeEmitter().emit(specs, none).some((f) => f.path.startsWith(".claude/agents/"))).toBe(false);
  });
});

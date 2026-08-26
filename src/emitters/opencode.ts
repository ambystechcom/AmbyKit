import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface, EmittedFile, Role, RulesContext } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * OpenCode emitter. Commands go to `.opencode/commands/*.md` (plural dir; invoked as `/amby.*`).
 * OpenCode reads AGENTS.md natively, so no tool-specific rules file is needed. `$ARGUMENTS` is
 * supported natively, so bodies are emitted verbatim.
 */
export class OpenCodeEmitter extends BaseEmitter {
  readonly toolId = "opencode";
  readonly displayName = "OpenCode";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir = join(".opencode", "commands");

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [["description", this.yamlQuote(spec.description)]];
  }

  /** Agents at `.opencode/agents/<id>.md` — filename is the id; `description` required (verified, feature 013). */
  protected override roleFiles(roles: Role[], _ctx: RulesContext): EmittedFile[] {
    return roles.map((role) => ({
      path: join(".opencode", "agents", `${this.personaName(role)}.md`),
      contents:
        `${this.renderFrontmatter([
          ["description", this.yamlQuote(this.personaDescription(role))],
          ["mode", "subagent"],
        ])}\n${this.personaBody(role)}\n`,
      scope: "project",
    }));
  }
}

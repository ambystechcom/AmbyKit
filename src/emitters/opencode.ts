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

  /**
   * Not written. OpenCode documents two incompatible shapes (`mcp.<name>` with `enabled`, and `mcp.servers.<name>`
   * with `disabled`) and nothing says which one an installed version reads, so a guess could break the user's
   * `opencode.json` (`specs/025-mcp-server/research.md`).
   */
  override mcpSkipReason(): string | null {
    return "OpenCode documents two incompatible MCP schemas and none is confirmed for installed versions; add the server by hand";
  }
}

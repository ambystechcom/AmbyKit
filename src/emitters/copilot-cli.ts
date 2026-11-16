import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import { MCP_COMMAND } from "./base-emitter.js";
import { CopilotEmitter } from "./copilot.js";
import { skillFrontmatter, skillPath } from "./skills-emitter.js";

/**
 * GitHub Copilot CLI (`copilot`) emitter. Reuses Copilot's `.github/` rules/instructions, but the
 * CLI has no prompt-file surface — its file-based extension point is **skills**. Each phase becomes
 * a skill at `.github/skills/amby-<id>/SKILL.md`. MCP for the CLI is a user-level file
 * (`~/.copilot/mcp-config.json`), which AmbyKit only writes with explicit consent (not emitted here).
 */
export class CopilotCliEmitter extends CopilotEmitter {
  override readonly toolId = "copilot-cli";
  override readonly displayName = "GitHub Copilot CLI";
  override readonly commandSurface: CommandSurface = "skills";
  override readonly commandDir = join(".github", "skills");

  /**
   * User-level `~/.copilot/mcp-config.json`, `mcpServers.ambykit` with `type: "local"` and the required
   * `tools` list. Written only with `sync --include-user`, and never part of the in-sync check. The CLI does
   * not read the VS Code `.vscode/mcp.json` Copilot writes, so that file is not inherited.
   */
  override mcpFiles(_ctx: RulesContext): EmittedFile[] {
    return [this.mcpFile(join(".copilot", "mcp-config.json"), "mcpServers", { type: "local", ...MCP_COMMAND, tools: ["*"] }, "user")];
  }

  // Inherits Copilot (rules, personas, `${input:args}`), so it reuses the skills helpers, not the class.
  protected override commandFilePath(spec: CommandSpec): string {
    return skillPath(this.commandDir, spec);
  }

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return skillFrontmatter(spec, (v) => this.yamlQuote(v));
  }
}

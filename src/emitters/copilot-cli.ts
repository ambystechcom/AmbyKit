import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
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

  // Inherits Copilot (rules, personas, `${input:args}`), so it reuses the skills helpers, not the class.
  protected override commandFilePath(spec: CommandSpec): string {
    return skillPath(this.commandDir, spec);
  }

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return skillFrontmatter(spec, (v) => this.yamlQuote(v));
  }
}

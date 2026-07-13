import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { CopilotEmitter } from "./copilot.js";

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

  /** Skill id: lowercase-hyphen, e.g. amby.specify → amby-specify. */
  private skillName(spec: CommandSpec): string {
    return spec.name.replace(/\./g, "-").toLowerCase();
  }

  protected override commandFilePath(spec: CommandSpec): string {
    return join(this.commandDir, this.skillName(spec), "SKILL.md");
  }

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [
      ["name", this.skillName(spec)],
      ["description", this.yamlQuote(spec.description)],
    ];
  }
}

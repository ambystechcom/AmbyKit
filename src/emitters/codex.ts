import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * OpenAI Codex CLI emitter. Its file-based command surface is **skills** — a directory per phase at
 * `.agents/skills/<name>/SKILL.md`, discovered from cwd up to the repo root. Documented frontmatter
 * is only `name` + `description`; there is no argument-placeholder convention (the deprecated,
 * user-level custom-prompts mechanism has one, but is out of scope — see spec 008 FR-003/FR-004).
 * Codex reads AGENTS.md natively, so no tool-specific rules file is emitted.
 */
export class CodexEmitter extends BaseEmitter {
  readonly toolId = "codex";
  readonly displayName = "Codex CLI";
  readonly commandSurface: CommandSurface = "skills";
  readonly commandDir = join(".agents", "skills");

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

  /** Skills have no `$ARGUMENTS`-style substitution, so the token becomes an instruction instead. */
  protected override transformBody(spec: CommandSpec): string {
    return spec.body.replaceAll("$ARGUMENTS", "the user's request that followed this skill invocation");
  }
}

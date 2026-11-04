import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Qwen Code emitter. Commands are Markdown + YAML at `.qwen/commands/*.md` (TOML is deprecated);
 * documented keys are `description` and `argument-hint`, and the argument placeholder is `{{args}}`.
 * Qwen reads AGENTS.md (per its source; see research R3), so no tool-specific rules file is emitted.
 */
export class QwenEmitter extends BaseEmitter {
  readonly toolId = "qwen";
  readonly displayName = "Qwen Code";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir = join(".qwen", "commands");

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [
      ["description", this.yamlQuote(spec.description)],
      ["argument-hint", this.yamlQuote(spec.argumentHint)],
    ];
  }

  protected override transformBody(spec: CommandSpec): string {
    return spec.body.replaceAll("$ARGUMENTS", "{{args}}");
  }
}

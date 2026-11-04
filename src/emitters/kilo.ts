import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Kilo Code emitter. Commands are Markdown + YAML at `.kilo/commands/*.md`; `description` is the
 * only key we emit, and `$ARGUMENTS` is supported natively, so bodies are emitted verbatim. Kilo
 * reads AGENTS.md, so no tool-specific rules file is emitted.
 */
export class KiloEmitter extends BaseEmitter {
  readonly toolId = "kilo";
  readonly displayName = "Kilo Code";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir = join(".kilo", "commands");

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [["description", this.yamlQuote(spec.description)]];
  }
}

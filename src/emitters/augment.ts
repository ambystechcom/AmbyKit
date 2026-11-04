import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Augment Code (Auggie) emitter. Commands are Markdown + YAML at `.augment/commands/*.md`;
 * documented keys are `description`, `argument-hint` and `model`, and `$ARGUMENTS` is supported
 * natively, so bodies are emitted verbatim. Augment reads AGENTS.md, so no rules file is emitted.
 */
export class AugmentEmitter extends BaseEmitter {
  readonly toolId = "augment";
  readonly displayName = "Augment Code";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir = join(".augment", "commands");

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [
      ["description", this.yamlQuote(spec.description)],
      ["argument-hint", this.yamlQuote(spec.argumentHint)],
    ];
  }
}

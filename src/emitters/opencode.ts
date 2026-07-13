import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
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
}

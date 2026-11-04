import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Windsurf emitter. Workflows are Markdown at `.windsurf/workflows/*.md` with no documented
 * frontmatter and a 12,000-character limit per file; the filename is the slash command. There is no
 * argument placeholder, so `$ARGUMENTS` becomes an instruction (the Codex wording). Windsurf reads
 * AGENTS.md, so no tool-specific rules file is emitted.
 */
export class WindsurfEmitter extends BaseEmitter {
  readonly toolId = "windsurf";
  readonly displayName = "Windsurf";
  readonly commandSurface: CommandSurface = "workflows";
  readonly commandDir = join(".windsurf", "workflows");

  protected override commandFrontmatter(_spec: CommandSpec): Array<[string, string]> {
    return [];
  }

  protected override transformBody(spec: CommandSpec): string {
    return spec.body.replaceAll("$ARGUMENTS", "the user's request that followed this workflow invocation");
  }
}

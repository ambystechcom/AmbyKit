import { join } from "node:path";
import type { CommandSpec, CommandSurface } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Google Antigravity (IDE) emitter. Its file-based command surface is **workflows** at
 * `.agents/workflows/*.md` (plural `.agents/`), with `description`-only frontmatter. Antigravity
 * reads AGENTS.md natively, so no tool-specific rules file is emitted. There is no file-based agent
 * format (SDK only). The `agy` CLI shares these workspace files (see AntigravityCliEmitter).
 */
export class AntigravityEmitter extends BaseEmitter {
  readonly toolId: string = "antigravity";
  readonly displayName: string = "Antigravity (IDE)";
  readonly commandSurface: CommandSurface = "workflows";
  readonly commandDir: string = join(".agents", "workflows");

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [["description", this.yamlQuote(spec.description)]];
  }
}

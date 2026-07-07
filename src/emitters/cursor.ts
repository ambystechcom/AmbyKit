import { join } from "node:path";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Cursor emitter. Commands go to `.cursor/commands/*.md` as plain prompt bodies (Cursor documents no
 * command frontmatter schema). An always-applied `.cursor/rules/ambykit.mdc` points at AGENTS.md
 * (which Cursor also reads natively).
 */
export class CursorEmitter extends BaseEmitter {
  readonly toolId: string = "cursor";
  readonly displayName: string = "Cursor";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir: string = join(".cursor", "commands");

  /** Cursor commands are plain markdown — no frontmatter. */
  protected override commandFrontmatter(_spec: CommandSpec): Array<[string, string]> {
    return [];
  }

  protected override rulesFiles(_ctx: RulesContext): EmittedFile[] {
    const contents = `---
description: AmbyKit Spec-Driven Development workflow
alwaysApply: true
---
This project uses **AmbyKit** for Spec-Driven Development. Follow the workflow and rules in
\`AGENTS.md\` (repository root). Use the \`/amby.*\` commands in \`.cursor/commands/\` to run each phase.

<!-- Managed by AmbyKit. Regenerate with \`ambykit sync\`. -->
`;
    return [{ path: join(".cursor", "rules", "ambykit.mdc"), contents, scope: "project" }];
  }
}

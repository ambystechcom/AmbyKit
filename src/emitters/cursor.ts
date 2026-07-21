import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import { buildPointerRegion } from "../core/rules.js";
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
    // The `.mdc` frontmatter is the greenfield preamble; the AmbyKit body is a pointer region spliced
    // non-destructively (merge lives in the body — the frontmatter has no headings to confuse it).
    const region = buildPointerRegion("Use the `/amby.*` commands in `.cursor/commands/` to run each phase.");
    const contents = `---
description: AmbyKit Spec-Driven Development workflow
alwaysApply: true
---

${region}`;
    return [{ path: join(".cursor", "rules", "ambykit.mdc"), contents, scope: "project", merge: "region" }];
  }
}

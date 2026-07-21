import type {
  AbstractTool,
  CommandSpec,
  CommandSurface,
  EmittedFile,
  RulesContext,
} from "../core/types.js";
import { buildPointerRegion } from "../core/rules.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * Claude Code emitter. Emits slash commands to `.claude/commands/amby.*.md` and a `CLAUDE.md`
 * bridge that imports `@AGENTS.md` (Claude Code does not read AGENTS.md natively). The VS Code
 * extension shares this exact output.
 */
export class ClaudeEmitter extends BaseEmitter {
  readonly toolId = "claude";
  readonly displayName = "Claude Code";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir = ".claude/commands";

  protected override readonly toolNameMap: Record<AbstractTool, string> = {
    read: "Read",
    write: "Write",
    edit: "Edit",
    bash: "Bash",
  };

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [
      ["description", this.yamlQuote(spec.description)],
      ["argument-hint", this.yamlQuote(spec.argumentHint)],
      ["allowed-tools", this.mappedTools(spec)],
    ];
  }

  protected override rulesFiles(_ctx: RulesContext): EmittedFile[] {
    // The `@AGENTS.md` import must stay on line 1 (Claude does not read AGENTS.md natively). It is
    // the `requiredPrefix` so a brownfield merge re-adds it if missing (FR-011); the AmbyKit body is
    // a pointer region spliced non-destructively into any existing CLAUDE.md (FR-001).
    const region = buildPointerRegion(
      "The `/amby.*` slash commands live in `.claude/commands/` (Claude reads `AGENTS.md` via the import above).",
    );
    const contents = `@AGENTS.md\n\n${region}`;
    return [{ path: "CLAUDE.md", contents, scope: "project", merge: "region", requiredPrefix: "@AGENTS.md" }];
  }
}

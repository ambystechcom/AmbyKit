import type {
  AbstractTool,
  CommandSpec,
  CommandSurface,
  EmittedFile,
  RulesContext,
} from "../core/types.js";
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
    const contents = `@AGENTS.md

# Claude Code

The shared, tool-neutral guidance is in \`@AGENTS.md\` above (imported). Claude Code does not read
\`AGENTS.md\` natively — the import on the first line is the bridge, so keep it there.

The AmbyKit workflow is available as \`/amby.*\` slash commands in \`.claude/commands/\`.

<!-- Managed by AmbyKit. Regenerate with \`ambykit sync\`. -->
`;
    return [{ path: "CLAUDE.md", contents, scope: "project" }];
  }
}

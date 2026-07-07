import { join } from "node:path";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/**
 * GitHub Copilot (VS Code) emitter. Phase prompts become prompt files at
 * `.github/prompts/*.prompt.md` (invoked as `/amby.*` in Copilot Chat); an always-on
 * `.github/copilot-instructions.md` points at the shared AGENTS.md. Copilot uses `${input:…}` for
 * arguments rather than `$ARGUMENTS`, so bodies are transformed.
 */
export class CopilotEmitter extends BaseEmitter {
  readonly toolId: string = "copilot";
  readonly displayName: string = "GitHub Copilot (VS Code)";
  readonly commandSurface: CommandSurface = "commands";
  readonly commandDir: string = join(".github", "prompts");

  protected override commandFileName(spec: CommandSpec): string {
    return `${spec.name}.prompt.md`;
  }

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return [
      ["description", this.yamlQuote(spec.description)],
      ["argument-hint", this.yamlQuote(spec.argumentHint)],
      ["agent", "agent"],
    ];
  }

  /** Copilot substitutes `${input:name}`; map our single `$ARGUMENTS` token to it. */
  protected override transformBody(spec: CommandSpec): string {
    return spec.body.replaceAll("$ARGUMENTS", "${input:args}");
  }

  protected override rulesFiles(_ctx: RulesContext): EmittedFile[] {
    const contents = `# GitHub Copilot instructions

This project uses **AmbyKit** for Spec-Driven Development. Follow the workflow and rules in
\`AGENTS.md\` (repository root). The \`/amby.*\` prompts under \`.github/prompts/\` drive the phases.

<!-- Managed by AmbyKit. Regenerate with \`ambykit sync\`. -->
`;
    return [{ path: join(".github", "copilot-instructions.md"), contents, scope: "project" }];
  }
}

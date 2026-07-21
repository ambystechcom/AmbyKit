import { join } from "node:path/posix";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import { buildPointerRegion } from "../core/rules.js";
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
    const region = buildPointerRegion("The `/amby.*` prompts under `.github/prompts/` drive the phases.");
    const contents = `# GitHub Copilot instructions\n\n${region}`;
    return [
      { path: join(".github", "copilot-instructions.md"), contents, scope: "project", merge: "region" },
    ];
  }
}

import { join } from "node:path/posix";
import { buildPointerRegion } from "../core/rules.js";
import type { EmittedFile, RulesContext } from "../core/types.js";
import { TomlCommandEmitter } from "./toml-command-emitter.js";

/**
 * Gemini CLI emitter. Commands are TOML at `.gemini/commands/amby.<phase>.toml` (invoked as
 * `/amby.<phase>`; `prompt` required, `description` optional, `{{args}}` for arguments). Gemini does
 * not read AGENTS.md by default, so a `GEMINI.md` pointer region carries the rules. AmbyKit never
 * edits `.gemini/settings.json` (Principle 7).
 */
export class GeminiEmitter extends TomlCommandEmitter {
  readonly toolId = "gemini";
  readonly displayName = "Gemini CLI";
  readonly commandDir = join(".gemini", "commands");

  protected override rulesFiles(_ctx: RulesContext): EmittedFile[] {
    const region = buildPointerRegion("The `/amby.*` commands under `.gemini/commands/` drive the phases.");
    return [{ path: "GEMINI.md", contents: `# Gemini CLI instructions\n\n${region}`, scope: "project", merge: "region" }];
  }
}

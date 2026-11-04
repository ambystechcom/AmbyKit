import { join } from "node:path/posix";
import { buildPointerRegion } from "../core/rules.js";
import type { EmittedFile, RulesContext } from "../core/types.js";
import { TomlCommandEmitter } from "./toml-command-emitter.js";

/**
 * LLxprt Code emitter (a Gemini CLI fork). Commands are TOML at `.llxprt/commands/amby.<phase>.toml`
 * with the same shape as Gemini's; the loader globs `**\/*.toml`. It reads `LLXPRT.md`, not AGENTS.md,
 * so a pointer region carries the rules.
 */
export class LlxprtEmitter extends TomlCommandEmitter {
  readonly toolId = "llxprt";
  readonly displayName = "LLxprt Code";
  readonly commandDir = join(".llxprt", "commands");

  protected override rulesFiles(_ctx: RulesContext): EmittedFile[] {
    const region = buildPointerRegion("The `/amby.*` commands under `.llxprt/commands/` drive the phases.");
    return [{ path: "LLXPRT.md", contents: `# LLxprt Code instructions\n\n${region}`, scope: "project", merge: "region" }];
  }
}

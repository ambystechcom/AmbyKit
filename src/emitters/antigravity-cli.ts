import type { EmittedFile, RulesContext } from "../core/types.js";
import { AntigravityEmitter } from "./antigravity.js";
import { MCP_COMMAND } from "./base-emitter.js";

/**
 * Antigravity CLI (`agy`) emitter. The CLI runs on the same agent harness as the IDE and reads the
 * same workspace files (`.agents/skills/`, AGENTS.md) and turns each skill into a slash command. Only
 * global/user paths differ, which AmbyKit does not manage, so this reuses the IDE emitter's output
 * apart from the `--agent=` self-report id.
 */
export class AntigravityCliEmitter extends AntigravityEmitter {
  override readonly toolId = "antigravity-cli";
  override readonly displayName = "Antigravity CLI";

  /** Workspace `.agents/mcp_config.json`, `mcpServers.ambykit` (verified for the CLI in `specs/025-mcp-server/research.md`). */
  override mcpFiles(_ctx: RulesContext): EmittedFile[] {
    return [this.mcpFile(".agents/mcp_config.json", "mcpServers", { ...MCP_COMMAND })];
  }

  override mcpSkipReason(): string | null {
    return null;
  }
}

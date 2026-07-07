import { AntigravityEmitter } from "./antigravity.js";

/**
 * Antigravity CLI (`agy`) emitter. The CLI runs on the same agent harness as the IDE and reads the
 * same workspace files (`.agents/workflows/`, AGENTS.md). Only global/user paths differ, which
 * AmbyKit does not manage — so this reuses the IDE emitter's output unchanged.
 */
export class AntigravityCliEmitter extends AntigravityEmitter {
  override readonly toolId = "antigravity-cli";
  override readonly displayName = "Antigravity CLI";
}

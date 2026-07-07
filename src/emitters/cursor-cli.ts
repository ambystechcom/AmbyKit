import type { CommandSurface } from "../core/types.js";
import { CursorEmitter } from "./cursor.js";

/**
 * Cursor CLI (`cursor-agent`) emitter. The CLI shares Cursor's config but has no slash-command
 * surface — it is rules-only. So it reuses `CursorEmitter`'s `.cursor/rules/*.mdc` (and the shared
 * AGENTS.md) and emits no command files.
 */
export class CursorCliEmitter extends CursorEmitter {
  override readonly toolId = "cursor-cli";
  override readonly displayName = "Cursor CLI";
  override readonly commandSurface: CommandSurface = "none";
}

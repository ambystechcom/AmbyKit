import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { LIVE_TOKENS } from "./live-tokens.js";
import { visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * EmptyState (feature 017, ui.md US-4, FR-031): a centered title plus a next-step hint whose
 * `command` part is highlighted. Pure.
 */
export function emptyState(caps: Capabilities, title: string, hint: { before: string; command?: string; after?: string }, width: number): string[] {
  const e = LIVE_TOKENS.component["empty-state"];
  const center = (s: string) => " ".repeat(Math.max(0, Math.floor((width - visibleWidth(s)) / 2))) + s;
  const hintText =
    paintToken(caps, e["hint-fg"], hint.before) +
    (hint.command ? paintToken(caps, TOKENS.component["hint-line"]["command-fg"], hint.command) : "") +
    (hint.after ? paintToken(caps, e["hint-fg"], hint.after) : "");
  return ["", center(paintToken(caps, e["title-fg"], title, true)), center(hintText), ""];
}

/** `Nothing matches filter "<f>" — esc to clear.` (ui.md US-4 empty states). */
export function noMatchLine(caps: Capabilities, filter: string): string {
  const dash = caps.unicode ? " — " : " - ";
  return paintToken(caps, TOKENS.semantic.color.muted, `Nothing matches filter "${filter}"${dash}esc to clear.`);
}

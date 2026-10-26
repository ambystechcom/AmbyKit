import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { formatAgo } from "./agent-badge.js";
import { glyph } from "./panel.js";
import { LIVE_TOKENS } from "./live-tokens.js";

/** Live-update state of the interactive dashboard (feature 017, data-model LiveState). */
export type LiveMode = "watching" | "polling" | "paused";

export interface LiveStatus {
  mode: LiveMode;
  lastChange: number; // epoch ms
}

/**
 * Header indicator (ui.md US-2 LiveIndicator): `● live · 3s ago`, `◌ polling · 3s ago`, or
 * `⚠ live paused — r to retry`. Plain/ASCII reads `live 3s ago`. Future times read `now` (clock skew).
 */
export function liveIndicator(caps: Capabilities, s: LiveStatus, now: number): string {
  const t = LIVE_TOKENS.component.live;
  const sep = caps.unicode ? " · " : " ";
  if (s.mode === "paused") {
    const dash = caps.unicode ? " — " : " - ";
    return paintToken(caps, t.paused.fg, `${glyph(caps, t.paused.glyph)} live paused${dash}r to retry`);
  }
  const ago = formatAgo(now - s.lastChange);
  const when = ago === "now" ? "now" : `${ago} ago`;
  if (!caps.unicode) return paintToken(caps, t["ago-fg"], `${s.mode === "watching" ? "live" : "poll"} ${when}`);
  const tok = s.mode === "watching" ? t.watching : t.polling;
  const label = s.mode === "watching" ? "live" : "polling";
  return paintToken(caps, tok.fg, `${glyph(caps, tok.glyph)} ${label}`) + paintToken(caps, t["ago-fg"], `${sep}${when}`);
}

import type { LaneView } from "../../../../core/fleet-view/types.js";

/**
 * SPIKE A (feature 029, T002): the Fleet view for N lanes on the existing hand-rolled layer plus one small
 * layout module. Throwaway until T032: the pieces that survive (`displayWidth`, `fit`, `layoutRows`) are
 * promoted into `fleet-view.ts` there; otherwise this file is removed. It draws no color and decides no
 * design (T022): column order and wording here are placeholders for measuring cost, not the signed-off layout.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

/**
 * Terminal cells a string takes: ANSI removed; East Asian wide and emoji count 2; combining marks 0; everything
 * else 1. Nerd Font glyphs live in the Private Use Area and have *ambiguous* width (1 in most terminals, 2 in
 * some), so they are counted 1 and drawn with a trailing space (see `ICON_PAD`).
 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s.replace(ANSI, "")) {
    const c = ch.codePointAt(0)!;
    if (c === 0x200d || (c >= 0x300 && c <= 0x36f) || (c >= 0xfe00 && c <= 0xfe0f)) continue;
    const wide = (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff);
    w += wide ? 2 : 1;
  }
  return w;
}

/** Truncate or pad to exactly `width` cells (ellipsis when cut). */
export function fit(s: string, width: number): string {
  const w = displayWidth(s);
  if (w === width) return s;
  if (w < width) return s + " ".repeat(width - w);
  let out = "";
  let used = 0;
  for (const ch of s) {
    const cw = displayWidth(ch);
    if (used + cw > width - 1) break;
    out += ch;
    used += cw;
  }
  return out + "…" + " ".repeat(Math.max(0, width - used - 1));
}

export type SpikeIcons = "nerd" | "unicode" | "ascii";

/** A glyph per state in each icon set, always paired with the state word (no state depends on a glyph, FR-010). */
export const SPIKE_GLYPH: Record<SpikeIcons, Record<string, string>> = {
  nerd: { working: "", waiting: "", blocked: "", paused: "", done: "", unreported: "", unknown: "" },
  unicode: { working: "▶", waiting: "◷", blocked: "⊘", paused: "⏸", done: "✓", unreported: "·", unknown: "?" },
  ascii: { working: "[>]", waiting: "[~]", blocked: "[x]", paused: "[|]", done: "[v]", unreported: "[.]", unknown: "[?]" },
};

/** Nerd glyph width is ambiguous: reserve two cells so a 2-wide font does not push the columns. */
export const ICON_PAD = 2;

export function laneRow(l: LaneView, icons: SpikeIcons, columns: number): string {
  const glyph = SPIKE_GLYPH[icons][l.state] ?? "?";
  const iconCell = fit(glyph, icons === "ascii" ? 3 : ICON_PAD);
  const quiet = l.idleMinutes === undefined ? "-" : `${l.idleMinutes}m`;
  const stalled = l.stalled ? ` STALLED ${quiet}` : "";
  const cols = [fit(l.lane, 9), fit(l.assistant, 8), `${iconCell} ${fit(l.state, 10)}`, fit(quiet, 5)];
  return fit(`${cols.join(" ")}${stalled}`, columns);
}

/** The whole body for `columns` cells wide, `rows` lines tall: a window over the lanes starting at `scroll`. */
export function layoutRows(lanes: LaneView[], opts: { icons: SpikeIcons; columns: number; rows: number; scroll?: number }): string[] {
  const start = Math.max(0, Math.min(opts.scroll ?? 0, Math.max(0, lanes.length - opts.rows)));
  return lanes.slice(start, start + opts.rows).map((l) => laneRow(l, opts.icons, opts.columns));
}

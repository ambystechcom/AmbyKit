import type { Capabilities, Glyph } from "../types.js";
import { paintToken } from "../theme.js";
import { TOKENS } from "./tokens.js";

/**
 * Framed panels and ANSI-aware text fitting for the dashboard (feature 014). Pure over `caps`.
 * Width math uses visible length (ANSI stripped), so colored content stays aligned.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
// eslint-disable-next-line no-control-regex
const TOKEN = /\x1b\[[0-9;]*m|[\s\S]/gu;
const RESET = "\x1b[0m";

/** Pick a glyph's unicode or ASCII form. */
export function glyph(caps: Capabilities, g: Glyph): string {
  return caps.unicode ? g.u : g.a;
}

/** Visible width of `s` in terminal columns (one column per code point; ANSI ignored). */
export function visibleWidth(s: string): number {
  return [...s.replace(ANSI, "")].length;
}

/** Truncation marker: `…`, or `~` on ASCII terminals. */
export function ellipsis(caps: Capabilities): string {
  return caps.unicode ? "…" : "~";
}

/** Cut `s` to at most `width` visible columns, ending with an ellipsis when cut. Keeps ANSI intact. */
export function truncateVisible(caps: Capabilities, s: string, width: number): string {
  if (visibleWidth(s) <= width) return s;
  const ell = ellipsis(caps);
  let out = "";
  let n = 0;
  let styled = false;
  for (const m of s.matchAll(TOKEN)) {
    const t = m[0];
    if (t.startsWith("\x1b[")) {
      out += t;
      styled = t !== RESET;
      continue;
    }
    if (n >= width - 1) break;
    out += t;
    n += 1;
  }
  return out + (styled ? RESET : "") + ell;
}

/** Pad (or truncate) `s` to exactly `width` visible columns. */
export function fitVisible(caps: Capabilities, s: string, width: number): string {
  const cut = truncateVisible(caps, s, width);
  return cut + " ".repeat(Math.max(0, width - visibleWidth(cut)));
}

/** Keep at most `max` lines; when more, the last kept line becomes `+N more` (ui.md US-3). */
export function elide(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const keep = Math.max(0, max - 1);
  return [...lines.slice(0, keep), `+${lines.length - keep} more`];
}

export interface PanelSpec {
  title: string;
  /** Right-aligned text in the top edge (e.g. `120 tasks`). */
  right?: string;
  /** Total width including both borders. */
  width: number;
  focused?: boolean;
}

/** A framed panel: rounded (or heavy when focused) border, title in the top edge, padded body. */
export function panel(caps: Capabilities, spec: PanelSpec, body: string[]): string[] {
  const p = TOKENS.component.panel;
  const t = spec.focused ? p.focused : p;
  const g = (x: Glyph): string => glyph(caps, x);
  const frame = (s: string): string => paintToken(caps, t["frame-fg"], s);
  const h = g(t["edge-h"]);
  const v = frame(g(t["edge-v"]));
  const inner = Math.max(0, spec.width - 2);

  const title = ` ${spec.title} `;
  const right = spec.right ? ` ${spec.right} ` : "";
  const fill = Math.max(0, inner - 1 - visibleWidth(title) - visibleWidth(right) - (right ? 1 : 0));
  const top =
    frame(g(t["corner-tl"]) + h) +
    paintToken(caps, t["title-fg"], title) +
    frame(h.repeat(fill)) +
    (right ? paintToken(caps, t["title-fg"], right) + frame(h) : "") +
    frame(g(t["corner-tr"]));
  const bottom = frame(g(t["corner-bl"]) + h.repeat(inner) + g(t["corner-br"]));
  const rows = body.map((line) => `${v} ${fitVisible(caps, line, Math.max(0, inner - 2))} ${v}`);
  return [top, ...rows, bottom];
}

/** Place blocks of lines side by side, separated by `gap` spaces; shorter blocks are padded. */
export function sideBySide(blocks: string[][], widths: number[], gap: number): string[] {
  const height = Math.max(0, ...blocks.map((b) => b.length));
  const out: string[] = [];
  for (let i = 0; i < height; i++) {
    const cells = blocks.map((b, j) => {
      const line = b[i] ?? "";
      return line + " ".repeat(Math.max(0, (widths[j] ?? 0) - visibleWidth(line)));
    });
    out.push(cells.join(" ".repeat(gap)).replace(/\s+$/, ""));
  }
  return out;
}

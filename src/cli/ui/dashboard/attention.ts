import type { AttentionItem } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { elide, glyph, panel } from "./panel.js";
import { TOKENS } from "./tokens.js";

/** Attention panel (feature 014, ui.md US-3): graph problems, blocked and waiting stories. */

const EMPTY = "Nothing blocked.";

/** One line per item: kind glyph, padded key, reason. `cursor` marks the selected row. */
export function attentionLines(caps: Capabilities, items: AttentionItem[], cursor?: number): string[] {
  const a = TOKENS.component["attention-item"];
  if (items.length === 0) return [paintToken(caps, TOKENS.semantic.color.muted, EMPTY)];
  const keyWidth = Math.max(...items.map((i) => i.key.length));
  return items.map((item, i) => {
    const kind = a[item.kind];
    const mark = cursor === undefined ? "" : i === cursor ? `${paintToken(caps, TOKENS.component.row["cursor-fg"], glyph(caps, TOKENS.component.row.cursor))} ` : "  ";
    return (
      mark +
      `${paintToken(caps, kind.fg, glyph(caps, kind.symbol))} ` +
      `${paintToken(caps, a["id-fg"], item.key.padEnd(keyWidth))}  ` +
      paintToken(caps, a["reason-fg"], caps.unicode ? item.reason : item.reason.replace(/—/g, "-"))
    );
  });
}

export function attentionPanel(
  caps: Capabilities,
  items: AttentionItem[],
  width: number,
  opts: { focused?: boolean; cursor?: number } = {},
): string[] {
  const max = TOKENS.component["attention-item"]["max-items"];
  // Interactive mode scrolls instead of eliding: keep a window around the cursor.
  let lines = attentionLines(caps, items, opts.cursor);
  if (opts.cursor !== undefined && lines.length > max) {
    const start = Math.min(Math.max(0, opts.cursor - max + 1), lines.length - max);
    lines = lines.slice(start, start + max);
  } else lines = elide(lines, max);
  const title = `ATTENTION${caps.unicode ? " · " : " - "}${items.length}`;
  return panel(caps, { title, width, focused: opts.focused }, lines);
}

/** Plain layout: `ATTENTION` then `  [x] 015:US-4  blocked-by US-2` lines. */
export function plainAttention(caps: Capabilities, items: AttentionItem[]): string[] {
  const max = TOKENS.component["attention-item"]["max-items"];
  if (items.length === 0) return ["ATTENTION", `  ${EMPTY}`];
  return ["ATTENTION", ...elide(attentionLines(caps, items), max).map((l) => `  ${l}`)];
}

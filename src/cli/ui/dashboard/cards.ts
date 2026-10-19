import type { Summary } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { glyph, panel, sideBySide, visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/** Header and summary cards for the dashboard overview (feature 014, ui.md US-1). Pure over `caps`. */

export interface HeaderMeta {
  crumb: string[];
  cwd: string;
  version: string;
  interactive?: boolean;
  /** Replaces the path/version meta (feature view: `implementing · 35%`). */
  right?: string;
}

/** Separator between header/caption parts: ` · `, or ` - ` on ASCII terminals. */
export function sep(caps: Capabilities): string {
  return caps.unicode ? " · " : " - ";
}

/**
 * Title line + heavy rule. The right-hand meta drops the path first, then the version, so the line
 * never wraps on a narrow terminal.
 */
export function header(caps: Capabilities, meta: HeaderMeta, width: number): string[] {
  const h = TOKENS.component.header;
  const crumb = [`AmbyKit${sep(caps)}dashboard`, ...meta.crumb].join(` ${glyph(caps, h.breadcrumb)} `);
  const left = `${paintToken(caps, h["brand-fg"], glyph(caps, h.brand))} ${paintToken(caps, TOKENS.semantic.color.text, crumb, true)}`;

  const parts = meta.right
    ? [meta.right]
    : [meta.cwd, `v${meta.version}`, ...(meta.interactive ? ["interactive"] : [])];
  const candidates = [parts, parts.slice(1), parts.slice(2), []];
  let right = "";
  for (const c of candidates) {
    const text = c.join(sep(caps));
    if (visibleWidth(left) + 2 + text.length <= width || c.length === 0) {
      right = text;
      break;
    }
  }
  const gap = Math.max(1, width - visibleWidth(left) - right.length);
  const title = right ? left + " ".repeat(gap) + paintToken(caps, h["meta-fg"], right) : left;
  const rule = paintToken(caps, h["rule-fg"], glyph(caps, h.rule).repeat(width));
  return [title, rule];
}

/** A completion bar of exactly `width` cells, to eighth-cell precision on unicode terminals. */
export function completionBar(caps: Capabilities, ratio: number | null, width: number): string {
  const b = TOKENS.component["completion-bar"];
  const empty = glyph(caps, b.empty);
  if (ratio === null || width <= 0) return paintToken(caps, b["fg-empty"], empty.repeat(Math.max(0, width)));
  const eighths = Math.round(Math.min(1, Math.max(0, ratio)) * width * 8);
  const full = Math.floor(eighths / 8);
  const partial = caps.unicode ? (b.eighths.u[eighths % 8] ?? "") : "";
  const filled = glyph(caps, b.fill).repeat(full) + partial;
  const rest = width - full - (partial ? 1 : 0);
  const fg = ratio >= 1 ? b["fg-complete"] : b["fg-partial"];
  return paintToken(caps, fg, filled) + paintToken(caps, b["fg-empty"], empty.repeat(Math.max(0, rest)));
}

interface CardContent {
  label: string;
  value: string;
  caption: string; // already styled
}

function cardContents(caps: Capabilities, s: Summary): CardContent[] {
  const c = TOKENS.component["summary-card"];
  const none = s.features === 0;
  const emptyGlyph = glyph(caps, c.empty);
  const cap = (text: string): string => paintToken(caps, c["caption-fg"], text);
  const doneOpen = (done: number, total: number): string =>
    none ? cap(emptyGlyph) : cap(`${done} done${sep(caps)}${total - done} open`);
  return [
    { label: "FEATURES", value: String(s.features), caption: doneOpen(s.featuresDone, s.features) },
    { label: "STORIES", value: String(s.stories), caption: doneOpen(s.storiesDone, s.stories) },
    {
      label: "TASKS",
      value: `${s.tasksDone} / ${s.tasksTotal}`,
      caption: none ? cap(emptyGlyph) : cap(`${s.tasksTotal - s.tasksDone} open`),
    },
    { label: "COMPLETE", value: s.percent === null ? emptyGlyph : `${s.percent}%`, caption: "" },
  ];
}

function card(caps: Capabilities, content: CardContent, width: number, percent: number | null): string[] {
  const c = TOKENS.component["summary-card"];
  const value = paintToken(caps, c["value-fg"], content.value, true);
  const second =
    content.label === "COMPLETE"
      ? completionBar(caps, percent === null ? null : percent / 100, Math.max(0, width - 6))
      : content.caption;
  return panel(caps, { title: content.label, width }, [value, second]);
}

/**
 * The four summary cards (FR-002). Wide: one row, three equal cards and COMPLETE taking the remainder
 * so its bar is as long as possible. Narrow: a 2×2 grid.
 */
export function summaryCards(
  caps: Capabilities,
  summary: Summary,
  width: number,
  mode: "wide" | "narrow",
): string[] {
  const gap = TOKENS.component.layout["card-gap"];
  const contents = cardContents(caps, summary);
  const build = (i: number, w: number): string[] => card(caps, contents[i]!, w, summary.percent);

  if (mode === "wide") {
    const small = Math.max(TOKENS.component.layout["card-min-width"] + 3, Math.floor(width / 5));
    const last = Math.max(small, width - 3 * small - 3 * gap);
    const widths = [small, small, small, last];
    return sideBySide(widths.map((w, i) => build(i, w)), widths, gap);
  }
  const left = Math.floor((width - gap) / 2);
  const right = width - gap - left;
  return [
    ...sideBySide([build(0, left), build(1, right)], [left, right], gap),
    ...sideBySide([build(2, left), build(3, right)], [left, right], gap),
  ];
}

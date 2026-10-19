import { STATUS_ORDER, type Status } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { glyph, visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * Story status stacked bar + legend (feature 014, ui.md US-2 StatusChart). Every segment has its own
 * fill pattern and the legend pairs glyph + word + count, so it reads with color off (FR-006).
 */

type Counts = Partial<Record<Status, number>>;

const tokenOf = (s: Status) => TOKENS.component["status-chart"][s];

/** Present statuses in fixed order. */
function present(counts: Counts): [Status, number][] {
  return STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => [s, counts[s]!]);
}

/**
 * Segment widths by largest remainder so they fill `width` exactly; any non-zero status keeps at
 * least one cell (taken from the widest segment).
 */
export function segmentWidths(values: number[], width: number): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0 || width <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * width);
  const out = exact.map(Math.floor);
  let left = width - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  for (let i = 0; i < out.length; i++) {
    if (values[i]! > 0 && out[i] === 0) {
      const widest = out.indexOf(Math.max(...out));
      if (out[widest]! > 1) {
        out[widest]! -= 1;
        out[i] = 1;
      }
    }
  }
  return out;
}

/** The stacked bar alone, exactly `width` cells. */
export function statusBar(caps: Capabilities, counts: Counts, width: number): string {
  const items = present(counts);
  const widths = segmentWidths(items.map(([, n]) => n), width);
  return items
    .map(([s], i) => paintToken(caps, tokenOf(s).fg, glyph(caps, tokenOf(s).fill).repeat(widths[i]!)))
    .join("");
}

/** Legend items (`✓ done 60 (87%)`), wrapped onto as many lines as `width` needs. */
export function statusLegend(caps: Capabilities, counts: Counts, width: number, shares = true): string[] {
  const c = TOKENS.component["status-chart"];
  const items = present(counts);
  const total = items.reduce((a, [, n]) => a + n, 0);
  const parts = items.map(([s, n]) => {
    const share = shares ? " " + paintToken(caps, c["share-fg"], `(${Math.round((n / total) * 100)}%)`) : "";
    return `${paintToken(caps, tokenOf(s).fg, glyph(caps, tokenOf(s).symbol))} ${paintToken(caps, c["legend-fg"], `${s} ${n}`)}${share}`;
  });
  const gap = shares ? "   " : "  ";
  const lines: string[] = [];
  let line = "";
  for (const p of parts) {
    const next = line ? line + gap + p : p;
    if (line && visibleWidth(next) > width) {
      lines.push(line);
      line = p;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Title, bar and legend; empty when there are no stories (the hint line covers that). */
export function statusChart(caps: Capabilities, counts: Counts, width: number, narrow = false): string[] {
  if (present(counts).length === 0) return [];
  return [
    paintToken(caps, TOKENS.semantic.color.text, "STORY STATUS", true),
    statusBar(caps, counts, width),
    ...statusLegend(caps, counts, width, !narrow),
  ];
}

/** Plain layout: ASCII bar and `[#] done 60 (87%)` legend keyed by fill pattern. */
export function plainStatusChart(caps: Capabilities, counts: Counts, width: number): string[] {
  const items = present(counts);
  if (items.length === 0) return [];
  const total = items.reduce((a, [, n]) => a + n, 0);
  const legend = items
    .map(([s, n]) => `[${glyph(caps, tokenOf(s).fill)}] ${s} ${n} (${Math.round((n / total) * 100)}%)`)
    .join("  ");
  return ["STORY STATUS", statusBar(caps, counts, width), legend];
}

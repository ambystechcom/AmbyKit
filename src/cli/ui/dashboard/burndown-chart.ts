import { periodNoun } from "../../../core/burndown.js";
import type { Burndown } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { glyph, panel } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * Burndown panel (feature 014, ui.md US-7): one stacked column per period — solid = remaining at the
 * bottom, shade = done on top — so column height is the task total and added scope shows as a taller
 * column. Whole-cell heights; remaining vs done is carried by fill pattern, not color (FR-006).
 */

export type BurndownState = Burndown | "computing";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const Y_LABEL = 3;
const PREFIX = Y_LABEL + 3; // "120 ┤ "

/** Maximum periods that fit a panel of `width` columns (one cell + one gap per period). */
export function maxPeriodsFor(width: number): number {
  return Math.max(2, Math.floor((width - 4 - PREFIX) / 2));
}

function dateLabel(iso: string, monthly: boolean): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS[Number(m) - 1] ?? m;
  return monthly ? `${month} ${y}` : `${month} ${Number(d)}`;
}

function delta(caps: Capabilities, n: number): string {
  if (n < 0) return `${caps.unicode ? "−" : "-"}${-n}`;
  return `+${n}`;
}

function noHistoryText(caps: Capabilities, b: Burndown): string {
  const dash = caps.unicode ? "—" : "-";
  if (b.reason === "not-a-repo") return `${dash} No history available: not a git repository.`;
  if (b.reason === "git-missing") return `${dash} No history available: git is not installed.`;
  return `${dash} No history available yet: tasks need changes in at least 2 periods.`;
}

function title(caps: Capabilities, b: BurndownState, feature?: string): string {
  const parts = ["BURNDOWN", ...(feature ? [feature] : [])];
  if (b !== "computing" && b.status === "ready" && b.period) parts.push(b.period);
  return parts.join(caps.unicode ? " · " : " - ");
}

/** The plotted rows, x-axis and labels (no frame). */
export function burndownPlot(caps: Capabilities, b: Burndown, width: number, height: number): string[] {
  const c = TOKENS.component.burndown;
  const points = b.points;
  const area = width - PREFIX;
  const bw = Math.max(1, Math.min(c["bar-width-max"], Math.floor(area / points.length) - 1));
  const max = Math.max(1, ...points.map((p) => p.total));
  const axis = (s: string): string => paintToken(caps, c["axis-fg"], s);
  const label = (s: string): string => paintToken(caps, c["label-fg"], s);
  const remainingCell = paintToken(caps, c["remaining-fg"], glyph(caps, c["remaining-fill"]).repeat(bw));
  const doneCell = paintToken(caps, c["done-fg"], glyph(caps, c["done-fill"]).repeat(bw));

  const heights = points.map((p) => {
    let hr = Math.round((p.remaining / max) * height);
    if (p.remaining > 0) hr = Math.max(1, hr);
    const ht = Math.max(hr, Math.round((p.total / max) * height));
    return { hr, ht };
  });

  const rows: string[] = [];
  for (let r = height - 1; r >= 0; r--) {
    const edge = r === height - 1 || r === 0;
    const y = r === height - 1 ? String(max) : r === 0 ? "0" : "";
    const tick = glyph(caps, edge ? c["axis-tick"] : c["axis-v"]);
    const cells = heights.map(({ hr, ht }) => (r < hr ? remainingCell : r < ht ? doneCell : " ".repeat(bw)));
    rows.push(`${label(y.padStart(Y_LABEL))} ${axis(tick)} ${cells.join(" ")}`.replace(/\s+$/, ""));
  }
  const plotWidth = points.length * (bw + 1) + 1;
  rows.push(" ".repeat(Y_LABEL + 1) + axis(glyph(caps, c["axis-corner"]) + glyph(caps, c["axis-h"]).repeat(plotWidth)));

  const monthly = b.period === "monthly";
  const picks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const xs = Array<string>(PREFIX + plotWidth + 12).fill(" ");
  let lastEnd = -1;
  for (const i of picks) {
    const text = dateLabel(points[i]!.periodStart, monthly);
    const at = PREFIX + i * (bw + 1);
    if (at <= lastEnd) continue;
    [...text].forEach((ch, k) => (xs[at + k] = ch));
    lastEnd = at + text.length;
  }
  rows.push(label(xs.join("").replace(/\s+$/, "")));
  return rows;
}

function legend(caps: Capabilities, b: Burndown): string {
  const c = TOKENS.component.burndown;
  const last = b.points.at(-1)!;
  const dot = caps.unicode ? " · " : " - ";
  const noun = periodNoun(b.period ?? "daily");
  return (
    `${paintToken(caps, c["remaining-fg"], glyph(caps, c["remaining-fill"]))} remaining   ` +
    `${paintToken(caps, c["done-fg"], glyph(caps, c["done-fill"]))} done   ` +
    paintToken(
      caps,
      c["label-fg"],
      `now: ${last.remaining} remaining${dot}${last.total - last.remaining} done${dot}${delta(caps, b.deltaRemaining ?? 0)} this ${noun}`,
    )
  );
}

/** The framed burndown panel in its ready, computing, or no-history state. */
export function burndownPanel(
  caps: Capabilities,
  b: BurndownState,
  width: number,
  mode: "wide" | "narrow",
  feature?: string,
): string[] {
  const c = TOKENS.component.burndown;
  const muted = (s: string): string => paintToken(caps, c["empty-fg"], s);
  if (b === "computing") return panel(caps, { title: title(caps, b, feature), width }, [muted(`computing history${caps.unicode ? "…" : "..."}`)]);
  if (b.status !== "ready") return panel(caps, { title: title(caps, b, feature), width }, [muted(noHistoryText(caps, b))]);
  const height = mode === "wide" ? c["height-wide"] : c["height-narrow"];
  const body = [...burndownPlot(caps, b, width - 4, height), "", legend(caps, b)];
  const total = b.points.at(-1)!.total;
  return panel(caps, { title: title(caps, b, feature), right: `${total} tasks`, width }, body);
}

/** Plain layout: a header line and the remaining-task series. */
export function plainBurndown(caps: Capabilities, b: BurndownState, feature?: string): string[] {
  const head = feature ? `BURNDOWN ${feature}` : "BURNDOWN";
  if (b === "computing") return [`${head}  computing history...`];
  if (b.status !== "ready") return [`${head}  ${noHistoryText(caps, b).replace(/^\S+ /, "")}`];
  const first = b.points[0]!;
  const last = b.points.at(-1)!;
  const monthly = b.period === "monthly";
  return [
    `${head} (${b.period}, ${dateLabel(first.periodStart, monthly)} - ${dateLabel(last.periodStart, monthly)})  ` +
      `now ${last.remaining} remaining of ${last.total}, ${delta({ ...caps, unicode: false }, b.deltaRemaining ?? 0)} this ${periodNoun(b.period ?? "daily")}`,
    `  remaining: ${b.points.map((p) => p.remaining).join(" ")}`,
  ];
}

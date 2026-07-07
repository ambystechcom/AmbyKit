import type { Capabilities, Cell, ProgressCell, StatusCell, TableModel } from "./types.js";
import { paint, symbols, type Style } from "./theme.js";

/**
 * Responsive table renderer (US-2/US-4). Pure over `caps` + `model`. Fits `model.width` by dropping
 * the lowest-`priority` columns first, then truncating string columns; progress/status cells are
 * never truncated. Width math uses **visible** length (ANSI-free) so colored output stays aligned
 * (FR-004/007).
 */

const GUTTER = 2;
const MIN_STRING_WIDTH = 3;
const BAR_WIDTH = 10;

const STATUS_STYLE: Record<string, Style> = {
  draft: "muted",
  ready: "accent",
  "in-progress": "warn",
  blocked: "danger",
  done: "success",
};

/** Build a progress cell. */
export function progressCell(done: number, total: number): ProgressCell {
  return { done, total };
}

/** Build a status cell. */
export function statusCell(status: string): StatusCell {
  return { status };
}

interface Resolved {
  visible: string;
  styled: string;
  /** Only string cells may be truncated to fit. */
  truncatable: boolean;
}

/** Render a table to a string that fits `model.width`. */
export function renderTable(caps: Capabilities, model: TableModel): string {
  const n = model.columns.length;
  const resolved: Resolved[][] = model.rows.map((row) =>
    Array.from({ length: n }, (_, i) => resolveCell(caps, row[i] ?? "")),
  );

  const natural = model.columns.map((col, i) =>
    Math.max(col.header.length, ...resolved.map((r) => r[i]!.visible.length)),
  );

  const keep = fitColumns(model.columns, natural, model.width);
  const widths = shrinkToFit(model, resolved, natural, keep, model.width);

  const headerCells = keep.map((i) =>
    pad(paint(caps, "muted", model.columns[i]!.header), model.columns[i]!.header, widths.get(i)!),
  );
  const ruleCells = keep.map((i) => paint(caps, "muted", "-".repeat(widths.get(i)!)));

  const lines = [joinCells(headerCells), joinCells(ruleCells)];
  for (const row of resolved) {
    const cells = keep.map((i) => {
      const cell = row[i]!;
      const width = widths.get(i)!;
      if (cell.truncatable && cell.visible.length > width) {
        const t = truncate(caps, cell.visible, width);
        return pad(t, t, width);
      }
      return pad(cell.styled, cell.visible, width);
    });
    lines.push(joinCells(cells));
  }
  return lines.join("\n");
}

/** Choose which columns to keep: drop the lowest-priority column until the row fits (min 1 col). */
function fitColumns(columns: TableModel["columns"], natural: number[], maxWidth: number): number[] {
  let keep = columns.map((_, i) => i);
  const total = (idxs: number[]) =>
    idxs.reduce((s, i) => s + (natural[i] ?? 0), 0) + GUTTER * Math.max(0, idxs.length - 1);
  while (total(keep) > maxWidth && keep.length > 1) {
    let drop = keep[0]!;
    for (const i of keep) if (columns[i]!.priority < columns[drop]!.priority) drop = i;
    keep = keep.filter((i) => i !== drop);
  }
  return keep;
}

/** After dropping, shrink truncatable string columns (lowest priority first) until the row fits. */
function shrinkToFit(
  model: TableModel,
  resolved: Resolved[][],
  natural: number[],
  keep: number[],
  maxWidth: number,
): Map<number, number> {
  const widths = new Map(keep.map((i) => [i, natural[i] ?? 0]));
  const total = () =>
    [...widths.values()].reduce((a, b) => a + b, 0) + GUTTER * Math.max(0, widths.size - 1);

  const shrinkable = keep
    .filter((i) => resolved.every((r) => r[i]!.truncatable))
    .sort((a, b) => model.columns[a]!.priority - model.columns[b]!.priority);

  let guard = 10_000;
  while (total() > maxWidth && shrinkable.some((i) => widths.get(i)! > MIN_STRING_WIDTH)) {
    for (const i of shrinkable) {
      if (total() <= maxWidth) break;
      const w = widths.get(i)!;
      if (w > MIN_STRING_WIDTH) widths.set(i, w - 1);
    }
    if (--guard <= 0) break;
  }
  return widths;
}

function resolveCell(caps: Capabilities, cell: Cell): Resolved {
  if (typeof cell === "string") return { visible: cell, styled: cell, truncatable: true };
  if ("status" in cell) {
    const style = STATUS_STYLE[cell.status] ?? "text";
    return { visible: cell.status, styled: paint(caps, style, cell.status), truncatable: false };
  }
  return { ...renderBar(caps, cell.done, cell.total), truncatable: false };
}

function renderBar(caps: Capabilities, done: number, total: number): { visible: string; styled: string } {
  const ratio = total > 0 ? done / total : 0;
  const pct = Math.round(ratio * 100);
  const filled = Math.round(ratio * BAR_WIDTH);
  const sym = symbols(caps);
  const bar = sym.barFill.repeat(filled) + sym.barEmpty.repeat(BAR_WIDTH - filled);
  const style: Style = pct >= 100 ? "success" : pct <= 0 ? "muted" : "accent";
  const pctStr = `${String(pct).padStart(3)}%`;
  return { visible: `${bar} ${pctStr}`, styled: `${paint(caps, style, bar)} ${pctStr}` };
}

/** Pad `styled` on the right to `width` visible columns (padding is plain spaces). */
function pad(styled: string, visible: string, width: number): string {
  return styled + " ".repeat(Math.max(0, width - visible.length));
}

function truncate(caps: Capabilities, s: string, width: number): string {
  if (s.length <= width) return s;
  const ell = caps.unicode ? "…" : "~";
  return s.slice(0, Math.max(0, width - 1)) + ell;
}

function joinCells(cells: string[]): string {
  return cells.join(" ".repeat(GUTTER)).replace(/\s+$/, "");
}

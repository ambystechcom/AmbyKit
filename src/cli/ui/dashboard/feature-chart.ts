import type { FeatureRow } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { completionBar } from "./cards.js";
import { fitVisible, glyph } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * Feature completion chart (feature 014, ui.md US-2 FeatureRow): one row per feature with its bar,
 * percentage, phase and open clarifications. Features without `tasks.md` read "not planned" (FR-005).
 */

const PHASE_WIDTH = 14;

/** `001 core-and-claude-emitter`; a colliding number shows the full directory name. */
export function featureLabel(row: FeatureRow): string {
  if (row.ref === row.name) return row.name;
  return `${row.ref} ${row.name.replace(/^\d+-/, "")}`;
}

function notPlanned(caps: Capabilities, width: number): string {
  const b = TOKENS.component["completion-bar"];
  const g = glyph(caps, b["not-planned"]);
  const label = `${g.repeat(3)} not planned `;
  return paintToken(caps, b["not-planned-fg"], (label + g.repeat(Math.max(0, width - label.length))).slice(0, width));
}

function row(caps: Capabilities, r: FeatureRow, nameWidth: number, barWidth: number, cursor?: string): string {
  const f = TOKENS.component["feature-row"];
  const label = featureLabel(r);
  const [ref, ...rest] = r.ref === r.name ? ["", label] : label.split(" ");
  const name = paintToken(caps, f["ref-fg"], ref ?? "") + (ref ? " " : "") + paintToken(caps, f["name-fg"], rest.join(" "));
  const bar =
    r.tasks === null
      ? notPlanned(caps, barWidth) + "     "
      : `${completionBar(caps, r.percent === null ? null : r.percent / 100, barWidth)} ${(r.percent === null ? "—" : `${r.percent}%`).padStart(4)}`;
  const phase = paintToken(caps, r.phase === "done" ? f["phase-done-fg"] : f["phase-fg"], r.phase.padEnd(PHASE_WIDTH));
  const clarif =
    r.clarifications > 0 ? paintToken(caps, f["clarif-fg"], String(r.clarifications)) : paintToken(caps, f["phase-fg"], glyph(caps, f["clarif-none"]));
  return `${cursor ?? ""}${fitVisible(caps, name, nameWidth)} ${bar}   ${phase}${clarif}`;
}

/**
 * The chart: title line with the `phase` / `clarif.` column heads, then one row per feature. `cursor`
 * marks the selected row in interactive mode (each row is then prefixed by two columns).
 */
export function featureChart(
  caps: Capabilities,
  rows: FeatureRow[],
  mode: "wide" | "narrow",
  cursor?: { index: number; glyph: string },
): string[] {
  if (rows.length === 0) return [];
  const f = TOKENS.component["feature-row"];
  const nameWidth = (mode === "wide" ? f["name-width-wide"] : f["name-width-narrow"]) + 4;
  const barWidth = mode === "wide" ? f["bar-width-wide"] : f["bar-width-narrow"];
  const lead = cursor ? 2 : 0;
  const title = paintToken(caps, TOKENS.semantic.color.text, "FEATURE COMPLETION", true);
  const heads = paintToken(caps, f["phase-fg"], `${"phase".padEnd(PHASE_WIDTH)}clarif.`);
  const headPad = lead + nameWidth + 1 + barWidth + 5 + 3 - "FEATURE COMPLETION".length;
  const lines = [title + " ".repeat(Math.max(1, headPad)) + heads];
  rows.forEach((r, i) => {
    const mark = cursor ? (i === cursor.index ? `${cursor.glyph} ` : "  ") : undefined;
    lines.push(row(caps, r, nameWidth, barWidth, mark));
  });
  return lines;
}

/** Plain layout rows: `008 brownfield-support      ##########  100%           done          .`. */
export function plainFeatureChart(caps: Capabilities, rows: FeatureRow[]): string[] {
  if (rows.length === 0) return [];
  const barWidth = 10;
  const lines = [`${"FEATURE COMPLETION".padEnd(56)}${"phase".padEnd(PHASE_WIDTH)}clarif.`];
  for (const r of rows) {
    const bar =
      r.tasks === null
        ? "-- not planned --".padEnd(barWidth + 6)
        : `${completionBar(caps, r.percent === null ? null : r.percent / 100, barWidth)}  ${(r.percent === null ? "-" : `${r.percent}%`).padStart(4)}`;
    const clarif = r.clarifications > 0 ? String(r.clarifications) : glyph(caps, TOKENS.component["feature-row"]["clarif-none"]);
    lines.push(`${fitVisible(caps, featureLabel(r), 27)} ${bar.padEnd(27)} ${r.phase.padEnd(PHASE_WIDTH)}${clarif}`);
  }
  return lines;
}

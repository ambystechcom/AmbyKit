import type { GapPoint, Metrics, MetricPhase, PhaseSummary } from "../../../core/metrics/types.js";
import type { MetricsState } from "../interactive/overview.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { effectiveColumns, iconGlyph, tabLayout } from "./layout.js";
import { panel, truncateVisible } from "./panel.js";
import { TAB_TOKENS as T } from "./tab-tokens.js";
import { tabErrorLine } from "./tab-frame.js";

/**
 * The FLOW panel in the quality tab (feature 032, US-4, ui.md): cycle time per phase and the converge gap trend, from
 * git history. Pure over the metrics read; never names a model, a network call or a path outside the repo (FR-016).
 * States: loading, ready, too-little-history, not-a-repo, git-missing, failed, skipped note; narrow and plain tiers.
 */

const M = T.component.metrics;
const PHASES: MetricPhase[] = ["spec", "plan", "tasks", "converge"];

/** `<1m`, `<n>m`, `<h>h <m>m` or `<d>d <h>h`; never seconds (ui.md). */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export type TrendKind = "improving" | "worsening" | "flat";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Improving when the latest rate is at least 10% below the median of the earlier converge runs, worsening when at least
 * 10% above, flat otherwise (signed-off decision 6). One run, or runs with no rate, are flat.
 */
export function gapTrend(points: GapPoint[]): TrendKind {
  const rates = points.map((p) => p.rate).filter((r): r is number => r !== null);
  if (rates.length < 2) return "flat";
  const latest = rates[rates.length - 1]!;
  const base = median(rates.slice(0, -1));
  const pct = M.trend["threshold-pct"] / 100;
  if (base === 0) return latest > 0 ? "worsening" : "flat";
  if (latest <= base * (1 - pct)) return "improving";
  if (latest >= base * (1 + pct)) return "worsening";
  return "flat";
}

/** A sparkline over `rates`, scaled to the largest, in the unicode or ASCII glyph set. */
export function sparkline(caps: Capabilities, rates: number[]): string {
  const set = [...iconGlyph(caps, M.spark.glyphs)];
  const max = Math.max(...rates, 0);
  return rates.map((r) => set[max === 0 ? 0 : Math.min(set.length - 1, Math.round((r / max) * (set.length - 1)))]!).join("");
}

function bar(caps: Capabilities, fraction: number): string {
  const width = M.bar.width;
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return paintToken(caps, M.bar.fg, iconGlyph(caps, M.bar.fill).repeat(filled)) + iconGlyph(caps, M.bar.empty).repeat(width - filled);
}

/** `014` from `014-enhanced-dashboard`. */
function featureNumber(feature: string): string {
  return /^(\d+)/.exec(feature)?.[1] ?? feature;
}

const muted = (caps: Capabilities, s: string): string => paintToken(caps, M["note-fg"], s);
const label = (caps: Capabilities, s: string): string => paintToken(caps, M["label-fg"], s);
const value = (caps: Capabilities, s: string): string => paintToken(caps, M["value-fg"], s);

function reasonLine(caps: Capabilities, m: Metrics): string {
  if (m.reason === "not-a-repo") return T.word["metrics-not-a-repo"];
  if (m.reason === "git-missing") return T.word["metrics-git-missing"];
  const finished = new Set(m.phases.flatMap((p) => p.perFeature.filter((c) => c.ms !== null).map((c) => c.feature))).size;
  return `${T.word["metrics-too-little"]}: only ${finished} feature${finished === 1 ? "" : "s"} ${finished === 1 ? "has" : "have"} a finished phase.`;
}

function phaseRow(caps: Capabilities, narrow: boolean, name: MetricPhase, summary: PhaseSummary | undefined): string {
  const typical = summary?.typicalMs ?? null;
  const done = (summary?.perFeature ?? []).filter((c) => c.ms !== null).sort((a, b) => b.ms! - a.ms!);
  const head = label(caps, name.padEnd(narrow ? 9 : M.col.label));
  const dash = caps.unicode ? "—" : "-";
  if (typical === null) return `${head}${narrow ? "" : dash.padEnd(M.col.typical)}${muted(caps, T.word["metrics-none-yet"])}`;
  if (narrow) return `${head}${value(caps, formatDuration(typical))} typical`;
  const longest = done[0]!.ms!;
  const top = done.slice(0, M.col["top-features"]).map((c) => `${featureNumber(c.feature)} ${formatDuration(c.ms!)}`).join("  ");
  return `${head}${value(caps, formatDuration(typical).padEnd(M.col.typical))}${bar(caps, longest === 0 ? 0 : typical / longest)}  ${muted(caps, top)}`;
}

function gapLines(caps: Capabilities, narrow: boolean, gap: GapPoint[]): string[] {
  const rated = gap.filter((g) => g.rate !== null);
  const trendKind = gapTrend(gap);
  const trend = M.trend[trendKind];
  const trendText = `${paintToken(caps, trend.fg, iconGlyph(caps, trend.glyph))} ${paintToken(caps, trend.fg, trend.word)}`;
  if (rated.length === 0) return [`${label(caps, narrow ? "gap rate".padEnd(9) : "CONVERGE GAP RATE".padEnd(M.col.label))}${muted(caps, "no converge run yet")}`];
  const shown = rated.slice(-M.spark["runs-shown"]);
  const latest = rated[rated.length - 1]!;
  const rate = latest.rate!.toFixed(2);
  if (narrow) return [`${label(caps, "gap rate".padEnd(9))}${value(caps, rate)} now, ${trendText}`];
  const dot = caps.unicode ? " · " : ", ";
  return [
    `${label(caps, "CONVERGE GAP RATE".padEnd(M.col.label))}${muted(caps, "gap tasks per requirement, per converge run")}`,
    `${paintToken(caps, M.spark.fg, sparkline(caps, shown.map((g) => g.rate!)))}   latest ${value(caps, rate)} (${latest.gapTasks} gap tasks / ${latest.requirements} requirements)${dot}trend ${trendText}`,
    muted(caps, shown.map((g) => `${featureNumber(g.feature)} ${g.rate!.toFixed(2)}`).join(dot)),
  ];
}

/** The FLOW panel's lines for the quality tab. `state` is absent outside the interactive dashboard (no panel then). */
export function renderMetricsPanel(caps: Capabilities, state: MetricsState | undefined): string[] {
  if (!state) return [];
  const layout = tabLayout(caps);
  const narrow = layout === "narrow";
  const dot = caps.unicode ? " · " : ", ";
  let title = "FLOW";
  let body: string[];
  if (state.status === "loading") {
    body = [muted(caps, T.word["metrics-loading"])];
  } else if (state.status === "failed") {
    body = [tabErrorLine(caps, "metrics", "git history is unavailable")];
  } else {
    const m = state.metrics;
    if (!m.enough) {
      body = [reasonLine(caps, m)];
    } else {
      const specCycles = m.phases.find((p) => p.phase === "spec")?.perFeature.length ?? 0;
      title = `FLOW${dot}from git history${dot}${specCycles} spec cycles${dot}${m.gap.length} converge runs`;
      const rows = PHASES.map((p) => phaseRow(caps, narrow, p, m.phases.find((s) => s.phase === p)));
      body = narrow
        ? [...rows.slice(0, 3), ...gapLines(caps, true, m.gap)]
        : [label(caps, `${"CYCLE TIME".padEnd(M.col.label)}${"TYPICAL".padEnd(M.col.typical)}FEATURES (longest ${M.col["top-features"]})`), ...rows, "", ...gapLines(caps, false, m.gap)];
    }
    if (m.skipped > 0) body.push(muted(caps, `${m.skipped} ${T.word["metrics-skipped"]}.`));
  }
  if (layout === "plain") return [title, ...body.map((l) => l.trimEnd())];
  const width = Math.min(effectiveColumns(caps), 100);
  return panel(caps, { title: narrow ? truncateVisible(caps, title, Math.max(8, width - 6)) : title, width }, body);
}

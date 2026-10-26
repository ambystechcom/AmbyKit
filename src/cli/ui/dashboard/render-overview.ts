import type { FeatureSnapshot, Overview, ParseIssue, Summary } from "../../../core/overview-types.js";
import { featureRow } from "../../../core/overview.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { plainAttention, attentionPanel } from "./attention.js";
import { burndownPanel, plainBurndown, type BurndownState } from "./burndown-chart.js";
import { header, summaryCards, type HeaderMeta } from "./cards.js";
import { featureChart, featureLabel, plainFeatureChart } from "./feature-chart.js";
import { artifactLines, checkoutAgentLines, featurePanels, storyTable } from "./feature-view.js";
import { layoutMode } from "./layout.js";
import { glyph, sideBySide } from "./panel.js";
import { plainStatusChart, statusChart } from "./status-chart.js";
import { plainUpNext, upNextPanel } from "./up-next.js";
import { TOKENS } from "./tokens.js";
import { hasWorktreeContent, plainWorktrees, worktreesPanel, type PresenceView } from "./worktrees-panel.js";

/**
 * Compose the one-shot dashboard (feature 014) in the layout `caps` call for: wide, narrow, or plain
 * (non-TTY / very narrow, FR-016). Pure — the command prints the result. Order follows ui.md US-1:
 * header, cards, story status, Attention + Up next, burndown, feature completion.
 */

/**
 * Overview focus panels (feature 017 adds Worktrees & agents): 0 Attention, 1 Up next,
 * 2 Worktrees & agents, 3 Feature completion.
 */
export type FocusPanel = 0 | 1 | 2 | 3;

export interface OverviewView {
  overview: Overview;
  meta: HeaderMeta;
  burndown?: BurndownState;
  /** Interactive focus/cursor (ui.md "Interactive mode"); absent in one-shot output. */
  focus?: { panel: FocusPanel; cursor: number };
  /** Agent presence (feature 017); absent ⇒ no agent column or rows. */
  presence?: PresenceView;
  /** Feature dirs changed by the last live refresh (feature 017, ChangedHighlight). */
  changed?: ReadonlySet<string>;
  /** Lines shown instead of the 014 hint when no feature is in scope (interactive EmptyState). */
  empty?: string[];
  /** Collapse more than this many skipped-file notices into one line (interactive). */
  noticeMax?: number;
}

export interface FeatureView {
  overview: Overview;
  feature: FeatureSnapshot;
  meta: HeaderMeta;
  burndown?: BurndownState;
  storyCursor?: number;
  presence?: PresenceView;
  /** Show CHECKOUT & AGENT even without a worktree or agent (interactive mode, feature 017). */
  agentPanel?: boolean;
  noticeMax?: number;
}

const SPECIFY = "/amby.specify";
const PLAIN_BAR = 60;

export function renderOverview(caps: Capabilities, view: OverviewView): string {
  const mode = layoutMode(caps);
  if (mode === "plain") return renderPlain(caps, view).join("\n");

  const width = caps.columns;
  const { overview, focus } = view;
  const lines = [...header(caps, view.meta, width), ...notices(caps, overview.issues, view.noticeMax), ""];
  lines.push(...summaryCards(caps, overview.summary, width, mode));
  if (overview.summary.features === 0) {
    lines.push(...(view.empty ?? ["", emptyHint(caps)]));
    return lines.join("\n");
  }
  const status = statusChart(caps, overview.statusCounts, width, mode === "narrow");
  if (status.length) lines.push("", ...status);
  lines.push("", ...attentionAndUpNext(caps, overview, width, mode, focus));
  // Interactive mode always has the panel (it is in the focus cycle); one-shot only when there is content.
  if (focus || hasWorktreeContent(overview.features, view.presence)) {
    const opts = {
      narrow: mode === "narrow",
      ...(focus ? { focused: focus.panel === 2, cursor: focus.panel === 2 ? focus.cursor : -1 } : {}),
    };
    lines.push("", ...worktreesPanel(caps, overview.features, view.presence, width, opts));
  }
  if (view.burndown) lines.push("", ...burndownPanel(caps, view.burndown, width, mode));
  const cursor =
    focus?.panel === 3 ? { index: focus.cursor, glyph: glyph(caps, TOKENS.component.row.cursor) } : undefined;
  lines.push("", ...featureChart(caps, overview.features, mode, cursor, chartExtras(view)));
  return lines.join("\n");
}

function attentionAndUpNext(
  caps: Capabilities,
  overview: Overview,
  width: number,
  mode: "wide" | "narrow",
  focus?: OverviewView["focus"],
): string[] {
  const at = (p: 0 | 1) => ({
    focused: focus?.panel === p,
    cursor: focus ? (focus.panel === p ? focus.cursor : -1) : undefined,
  });
  if (mode === "narrow") {
    return [
      ...attentionPanel(caps, overview.attention, width, at(0)),
      ...upNextPanel(caps, overview.upNext, width, at(1)),
    ];
  }
  const gap = TOKENS.component.layout["panel-gap"];
  const left = Math.floor((width - gap) / 2);
  const right = width - gap - left;
  return sideBySide(
    [attentionPanel(caps, overview.attention, left, at(0)), upNextPanel(caps, overview.upNext, right, at(1))],
    [left, right],
    gap,
  );
}

function chartExtras(view: { presence?: PresenceView; changed?: ReadonlySet<string> }) {
  return {
    ...(view.presence ? { agents: view.presence.byFeature } : {}),
    ...(view.changed ? { changed: view.changed } : {}),
  };
}

/** One `⚠ skipped <file>: <reason>` line per unreadable file (FR-014). */
function notices(caps: Capabilities, issues: ParseIssue[], max?: number): string[] {
  const n = TOKENS.component.notice;
  if (max !== undefined && issues.length > max) {
    // Interactive screens keep the header compact; the list is in the help overlay (ui.md US-4).
    const dash = caps.unicode ? " — " : " - ";
    return [paintToken(caps, n.fg, `${glyph(caps, n.symbol)} ${issues.length} files skipped${dash}? for details`)];
  }
  return issues.map((i) => paintToken(caps, n.fg, `${glyph(caps, n.symbol)} skipped ${i.file}: ${i.reason}`));
}

function emptyHint(caps: Capabilities): string {
  const h = TOKENS.component["hint-line"];
  return (
    paintToken(caps, h.fg, "No features yet. Run ") +
    paintToken(caps, h["command-fg"], SPECIFY) +
    paintToken(caps, h.fg, " in your assistant to create the first spec.")
  );
}

/** Plain layout: static text, no frames or color, ASCII-safe (ui.md "Plain layout"). */
function renderPlain(caps: Capabilities, view: OverviewView): string[] {
  const { overview, meta } = view;
  const live = meta.live ? `  ${meta.live}` : "";
  const lines = [`AmbyKit dashboard  ${meta.cwd}  v${meta.version}${live}`, ...plainNotices(caps, overview.issues)];
  lines.push("", plainSummary(caps, overview.summary));
  if (overview.summary.features === 0) {
    lines.push("", `No features yet. Run ${SPECIFY} in your assistant to create the first spec.`);
    return lines;
  }
  const status = plainStatusChart(caps, overview.statusCounts, PLAIN_BAR);
  if (status.length) lines.push("", ...status);
  lines.push("", ...plainAttention(caps, overview.attention), ...plainUpNext(caps, overview.upNext));
  const worktrees = plainWorktrees(caps, overview.features, view.presence);
  if (worktrees.length) lines.push("", ...worktrees);
  if (view.burndown) lines.push("", ...plainBurndown(caps, view.burndown));
  lines.push("", ...plainFeatureChart(caps, overview.features, chartExtras(view)));
  return lines;
}

function plainNotices(caps: Capabilities, issues: ParseIssue[]): string[] {
  return issues.map((i) => `${glyph(caps, TOKENS.component.notice.symbol)} skipped ${i.file}: ${i.reason}`);
}

function plainSummary(caps: Capabilities, s: Summary): string {
  const empty = glyph(caps, TOKENS.component["summary-card"].empty);
  const done = (n: number): string => (s.features === 0 ? "" : ` (${n} done)`);
  return [
    `FEATURES ${s.features}${done(s.featuresDone)}`,
    `STORIES ${s.stories}${done(s.storiesDone)}`,
    `TASKS ${s.tasksDone}/${s.tasksTotal}`,
    `COMPLETE ${s.percent === null ? empty : `${s.percent}%`}`,
  ].join("   ");
}

/** `implementing · 35%` — the right-hand header meta of a feature view. */
function featureMeta(caps: Capabilities, f: FeatureSnapshot): string {
  const row = featureRow(f);
  const pct = row.percent === null ? glyph(caps, TOKENS.component["summary-card"].empty) : `${row.percent}%`;
  return `${row.phase}${caps.unicode ? " · " : " - "}${pct}`;
}

/** The feature drill-down (US-5): panels, story table, then Attention, Up next and burndown, all filtered. */
export function renderFeatureView(caps: Capabilities, view: FeatureView): string {
  const mode = layoutMode(caps);
  const { feature: f, overview } = view;
  const label = featureLabel(featureRow(f));
  if (mode === "plain") {
    const row = featureRow(f);
    const lines = [`AmbyKit dashboard > ${label}  ${row.phase}  ${row.percent === null ? "-" : `${row.percent}%`}`];
    lines.push(...plainNotices(caps, overview.issues), "");
    lines.push(
      "ARTIFACTS  " + artifactLines(f).map((a) => `${a.file} ${a.detail || "present"}`).join("   "),
      ...plainCheckoutAgent(caps, f, view.presence),
      `OPEN CLARIFICATIONS ${f.clarifications.length}`,
      ...f.clarifications.map((c) => `  L${c.line}  ${c.text}`),
      "",
      ...storyTable(caps, f, overview.attention, caps.columns),
      "",
      ...plainAttention(caps, overview.attention),
      ...plainUpNext(caps, overview.upNext),
    );
    if (view.burndown) lines.push("", ...plainBurndown(caps, view.burndown, f.displayRef));
    return lines.join("\n");
  }
  const width = caps.columns;
  const meta = { ...view.meta, crumb: [label], right: featureMeta(caps, f) };
  const lines = [...header(caps, meta, width), ...notices(caps, overview.issues, view.noticeMax), ""];
  const presence = view.presence?.byFeature.get(f.dir);
  const agentCtx =
    view.agentPanel || f.checkout || presence ? { ...(presence ? { presence } : {}), now: view.presence?.now ?? Date.now() } : undefined;
  lines.push(...featurePanels(caps, f, width, mode, agentCtx), "");
  lines.push(...storyTable(caps, f, overview.attention, width, view.storyCursor));
  lines.push("", ...attentionAndUpNext(caps, overview, width, mode));
  if (view.burndown) lines.push("", ...burndownPanel(caps, view.burndown, width, mode, f.displayRef));
  return lines.join("\n");
}

/** Plain CHECKOUT & AGENT line (feature 017), only when there is a worktree or an agent. */
function plainCheckoutAgent(caps: Capabilities, f: FeatureSnapshot, presence?: PresenceView): string[] {
  const p = presence?.byFeature.get(f.dir);
  if (!f.checkout && !p) return [];
  const flat = { ...caps, unicode: false, color: false };
  const lines = checkoutAgentLines(flat, f, { ...(p ? { presence: p } : {}), now: presence?.now ?? Date.now() });
  return [`CHECKOUT & AGENT  ${lines.join("  ")}`];
}

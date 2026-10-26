import type { Presence, UnlocatedAgent } from "../../../core/activity.js";
import type { FeatureRow } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { agentBadge, checkoutBadge, checkoutTag, phaseLabel, presenceLabel } from "./agent-badge.js";
import { featureLabel } from "./feature-chart.js";
import { fitVisible, glyph, panel } from "./panel.js";
import { LIVE_TOKENS } from "./live-tokens.js";
import { TOKENS } from "./tokens.js";

/**
 * WORKTREES & AGENTS panel (feature 017, ui.md US-3 WorktreesPanel): one row per feature worktree,
 * plus primary-checkout features with a fresh agent, then agents we cannot tie to a feature. Pure.
 */

export interface PresenceView {
  byFeature: ReadonlyMap<string, Presence>;
  unlocated: UnlocatedAgent[];
  now: number;
}

export interface WorktreeItem {
  feature: FeatureRow;
  presence?: Presence;
}

const RANK: Record<string, number> = { active: 0, idle: 1, stale: 2 };

/**
 * Openable rows in display order: worktree features and main features with a non-stale agent,
 * ordered active → idle → stale/none, then by feature number (FR-029). The reducer uses this too.
 */
export function worktreeItems(rows: FeatureRow[], presence?: PresenceView): WorktreeItem[] {
  const items: (WorktreeItem & { order: number })[] = [];
  rows.forEach((feature, order) => {
    const p = presence?.byFeature.get(feature.name);
    if (feature.checkout || (p && p.state !== "stale")) items.push({ feature, ...(p ? { presence: p } : {}), order });
  });
  return items
    .sort((a, b) => (RANK[a.presence?.state ?? ""] ?? 3) - (RANK[b.presence?.state ?? ""] ?? 3) || a.order - b.order)
    .map(({ order: _order, ...item }) => item);
}

/** Whether the panel has anything to show (one-shot output omits it otherwise). */
export function hasWorktreeContent(rows: FeatureRow[], presence?: PresenceView): boolean {
  return worktreeItems(rows, presence).length > 0 || (presence?.unlocated.length ?? 0) > 0;
}

function itemLine(caps: Capabilities, item: WorktreeItem, now: number, narrow: boolean): string {
  const name = fitVisible(caps, featureLabel(item.feature), narrow ? 20 : 24);
  const where = narrow ? fitVisible(caps, checkoutTag(caps, item.feature.checkout), 3) : fitVisible(caps, checkoutBadge(caps, item.feature.checkout), 32);
  const p = item.presence;
  const none = paintToken(caps, TOKENS.semantic.color.muted, glyph(caps, TOKENS.component["summary-card"].empty));
  const agent = fitVisible(caps, p ? agentBadge(caps, p, narrow ? "glyph" : "full") : none, narrow ? 4 : 16);
  const phase = fitVisible(caps, p ? phaseLabel(caps, p) : "", narrow ? 12 : 18);
  const state = p
    ? presenceLabel(caps, p, now)
    : item.feature.checkout?.stale
      ? paintToken(caps, LIVE_TOKENS.component["checkout-tag"].stale.fg, `${caps.unicode ? "⊘" : "-"} merged`)
      : "";
  return `${name} ${where} ${agent} ${phase} ${state}`;
}

function unlocatedLine(caps: Capabilities, u: UnlocatedAgent, narrow: boolean): string {
  const muted = TOKENS.semantic.color.muted;
  const label = u.where === "main" ? "(main checkout)" : "(unknown location)";
  const name = fitVisible(caps, paintToken(caps, muted, `${glyph(caps, TOKENS.component["feature-row"]["clarif-none"])}   ${label}`), narrow ? 20 : 24);
  return `${name} ${agentBadge(caps, { agent: u.agent, source: "detected" }, narrow ? "glyph" : "full")}  ${paintToken(caps, muted, "running")}`;
}

/** Framed panel; `cursor` is the selected item index in interactive mode (-1 = none). */
export function worktreesPanel(
  caps: Capabilities,
  rows: FeatureRow[],
  presence: PresenceView | undefined,
  width: number,
  opts: { focused?: boolean; cursor?: number; narrow?: boolean } = {},
): string[] {
  const items = worktreeItems(rows, presence);
  const unlocated = presence?.unlocated ?? [];
  const now = presence?.now ?? Date.now();
  const r = TOKENS.component.row;
  const lead = opts.cursor !== undefined;
  const mark = (i: number) => (lead ? (i === opts.cursor ? paintToken(caps, r["cursor-fg"], glyph(caps, r.cursor)) + " " : "  ") : "");
  const body = items.map((it, i) => mark(i) + itemLine(caps, it, now, Boolean(opts.narrow)));
  body.push(...unlocated.map((u) => (lead ? "  " : "") + unlocatedLine(caps, u, Boolean(opts.narrow))));
  if (body.length === 0) body.push(emptyLine(caps));
  const max = opts.narrow ? LIVE_TOKENS.component["worktrees-panel"]["max-narrow"] : LIVE_TOKENS.component["worktrees-panel"]["max-wide"];
  const shown = scrollWindow(body, max, opts.cursor ?? 0, caps);
  const sep = caps.unicode ? " · " : " - ";
  return panel(caps, { title: `WORKTREES & AGENTS${sep}${items.length + unlocated.length}`, width, focused: opts.focused }, shown);
}

function emptyLine(caps: Capabilities): string {
  const h = TOKENS.component["hint-line"];
  const dash = caps.unicode ? " — " : " - ";
  return paintToken(caps, h.fg, `No feature worktrees yet${dash}run `) + paintToken(caps, h["command-fg"], "ambykit worktree NNN-slug") + paintToken(caps, h.fg, " to start one.");
}

/** Keep at most `max` lines around the cursor, marking hidden rows with an elision line. */
function scrollWindow(lines: string[], max: number, cursor: number, caps: Capabilities): string[] {
  if (lines.length <= max) return lines;
  const e = TOKENS.component.elision;
  const start = Math.min(Math.max(0, cursor - max + 2), lines.length - max + 1);
  const visible = lines.slice(start, start + max - 1);
  const hidden = lines.length - visible.length;
  return [...visible, paintToken(caps, e.fg, `${glyph(caps, e.glyph)}  ${hidden} more`)];
}

/** Plain layout (non-TTY / NO_COLOR / ASCII): static rows, no frame. */
export function plainWorktrees(caps: Capabilities, rows: FeatureRow[], presence: PresenceView | undefined): string[] {
  const items = worktreeItems(rows, presence);
  const unlocated = presence?.unlocated ?? [];
  if (items.length === 0 && unlocated.length === 0) return [];
  const now = presence?.now ?? Date.now();
  const lines = ["WORKTREES & AGENTS"];
  for (const it of items) {
    const c = it.feature.checkout;
    const where = c ? `wt ${c.branch ?? "(detached)"}${c.dirty ? " dirty" : ""}${c.stale ? " merged" : ""}` : "main";
    const p = it.presence;
    const agent = p ? `${p.source === "detected" ? "~" : ""}${agentBadge({ ...caps, unicode: false, color: false }, { ...p, source: "reported" })}` : "-";
    const what = p ? `${[p.phase, p.task].filter(Boolean).join(" ")}  ${presenceLabel({ ...caps, unicode: false, color: false }, p, now).replace(/^\[.\] /, "")}` : "";
    lines.push(`  ${featureLabel(it.feature)}  ${where}  ${agent}  ${what}`.trimEnd());
  }
  for (const u of unlocated) {
    lines.push(`  ${u.where === "main" ? "(main checkout)" : "(unknown location)"}  ~${agentBadge({ ...caps, unicode: false, color: false }, { agent: u.agent, source: "reported" })}  running`);
  }
  return lines;
}


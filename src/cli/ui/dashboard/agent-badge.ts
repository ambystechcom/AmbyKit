import type { Presence } from "../../../core/activity.js";
import type { Checkout } from "../../../core/overview-types.js";
import { iconMode } from "../capabilities.js";
import { paintToken, type ColorToken } from "../theme.js";
import type { Capabilities, Glyph } from "../types.js";
import { glyph } from "./panel.js";
import { LIVE_TOKENS } from "./live-tokens.js";
import { TOKENS } from "./tokens.js";

/**
 * Checkout tags, agent badges and presence labels (feature 017, ui.md US-1/US-3). Pure over `caps`.
 * Color is identity for agents and status for presence; both always travel with a glyph or word.
 */

interface AgentTokens {
  name: string;
  glyph: Glyph;
  nerd: Glyph;
  fg: ColorToken;
}

const AGENTS = LIVE_TOKENS.component.agent as unknown as Record<string, AgentTokens>;

function agentTokens(id: string): AgentTokens {
  const known = AGENTS[id];
  if (known && "glyph" in known) return known;
  const g = AGENTS["generic"]!;
  return { ...g, name: id }; // unknown id: generic badge, raw id as the name (FR-026)
}

export function agentName(id: string): string {
  return agentTokens(id).name || id;
}

/**
 * The agent's icon alone: unicode, or the ASCII tag (FR-025). Nerd mode keeps the unicode icon too:
 * the brand glyphs (`cod-claude`, `cod-openai`) are recent, and older Nerd Fonts render them as boxes.
 */
export function agentGlyph(caps: Capabilities, id: string): string {
  const t = agentTokens(id);
  const mode = iconMode(caps);
  const g = mode === "ascii" ? t.glyph.a : t.glyph.u;
  // Bold: a terminal can't enlarge one glyph, but a heavier stroke keeps small icons legible.
  return paintToken(caps, t.fg, g, true);
}

/** `✸ Claude` (full) or `✸` (glyph form, narrow); detected agents get the `~` prefix (FR-022). */
export function agentBadge(caps: Capabilities, p: Pick<Presence, "agent" | "source">, form: "full" | "glyph" = "full"): string {
  const d = LIVE_TOKENS.component.agent.detected;
  const prefix = p.source === "detected" ? paintToken(caps, d.fg, glyph(caps, d.prefix)) + " " : "";
  const icon = agentGlyph(caps, p.agent);
  if (form === "glyph") return prefix + icon;
  return `${prefix}${icon} ${paintToken(caps, agentTokens(p.agent).fg, agentName(p.agent))}`;
}

/** `now`, `12s`, `3m`, `2h`, `4d` — never negative (clock skew reads as now). */
export function formatAgo(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** `● active 12s` / `○ idle 18m` / `– stale 2h`. */
export function presenceLabel(caps: Capabilities, p: Presence, now: number): string {
  const t = LIVE_TOKENS.component.presence[p.state];
  return paintToken(caps, t.fg, `${glyph(caps, t.glyph)} ${p.state} ${formatAgo(now - p.since)}`);
}

/** `implement · T014` */
export function phaseLabel(caps: Capabilities, p: Presence): string {
  const parts = [p.phase, p.task].filter(Boolean) as string[];
  return paintToken(caps, TOKENS.semantic.color.muted, parts.join(caps.unicode ? " · " : " - "));
}

/** Visible width of the short checkout tag column. */
export function tagWidth(caps: Capabilities): number {
  return caps.unicode ? 2 : 3;
}

/** The worktree glyph: the Octicons git-branch in Nerd mode, else `⎇`, else `wt`. */
export function worktreeGlyph(caps: Capabilities): string {
  const t = LIVE_TOKENS.component["checkout-tag"];
  return iconMode(caps) === "nerd" ? t.nerd.u : glyph(caps, t.glyph);
}

/** Short checkout tag: `⎇` worktree, `⎇●` dirty, `⎇⊘` merged; empty for the primary checkout. */
export function checkoutTag(caps: Capabilities, c: Checkout | undefined): string {
  if (!c || c.kind !== "worktree") return "";
  const t = LIVE_TOKENS.component["checkout-tag"];
  let s = paintToken(caps, t.fg, worktreeGlyph(caps));
  if (c.dirty) s += paintToken(caps, t.dirty.fg, glyph(caps, t.dirty.glyph));
  else if (c.stale) s += paintToken(caps, t.stale.fg, caps.unicode ? glyph(caps, t.stale.glyph) : "-");
  return s;
}

/** Long form: `⎇ 017-live-dashboard · dirty · merged`, or `main`. */
export function checkoutBadge(caps: Capabilities, c: Checkout | undefined): string {
  const muted = TOKENS.semantic.color.muted;
  if (!c || c.kind !== "worktree") return paintToken(caps, muted, "main");
  const t = LIVE_TOKENS.component["checkout-tag"];
  const sep = caps.unicode ? " · " : " - ";
  let s = `${paintToken(caps, t.fg, worktreeGlyph(caps))} ${c.branch ?? "(detached)"}`;
  if (c.dirty) s += sep + paintToken(caps, t.dirty.fg, "dirty");
  if (c.stale) s += sep + paintToken(caps, t.stale.fg, "merged");
  return s;
}

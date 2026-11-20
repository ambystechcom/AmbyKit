import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { iconGlyph, tabLayout } from "./layout.js";
import { TAB_TOKENS as T } from "./tab-tokens.js";
import { glyph } from "./panel.js";
import { TABS, type Tab } from "../interactive/tabs.js";

/**
 * The tab bar (feature 032, US-1, ui.md "Tabbed frame"): `[1 overview]   2 fleet   3 graph   4 quality`. The active tab is
 * bracketed, bold and accented, so it reads without color; the number is always shown (it is the jump key); a badge marks a tab
 * whose body has something to read first. Narrow terminals use the three-letter names; a non-terminal prefixes `TABS:`. Pure.
 */

export type TabBadge = "attention" | "warn";
export type TabBadges = Partial<Record<Tab, TabBadge>>;

const NAMES: Record<Tab, string> = {
  overview: T.word["tab-overview"],
  fleet: T.word["tab-fleet"],
  graph: T.word["tab-graph"],
  quality: T.word["tab-quality"],
};
const SHORT: Record<Tab, string> = {
  overview: T.component["tab-bar"].narrow.names.overview,
  fleet: T.component["tab-bar"].narrow.names.fleet,
  graph: T.component["tab-bar"].narrow.names.graph,
  quality: T.component["tab-bar"].narrow.names.quality,
};

export interface TabBarInput {
  active: Tab;
  badges?: TabBadges;
}

export function renderTabBar(caps: Capabilities, input: TabBarInput): string {
  const bar = T.component["tab-bar"];
  const layout = tabLayout(caps);
  const names = layout === "narrow" ? SHORT : NAMES;
  const cells = TABS.map((tab, i) => {
    const badge = input.badges?.[tab];
    const mark = badge ? bar.badge[badge] : null;
    const badgeText = mark ? ` ${paintToken(caps, mark.fg, iconGlyph(caps, mark.glyph))}` : "";
    const number = String(i + 1);
    if (tab === input.active) {
      const open = glyph(caps, bar.active.open);
      const close = glyph(caps, bar.active.close);
      return paintToken(caps, bar.active.fg, `${open}${number} ${names[tab]}`, true) + badgeText + paintToken(caps, bar.active.fg, close, true);
    }
    return `${paintToken(caps, bar["number-fg"], number)} ${paintToken(caps, bar.inactive.fg, names[tab])}${badgeText}`;
  });
  const gap = layout === "narrow" ? " " : " ".repeat(bar.gap);
  return `${layout === "plain" ? "TABS: " : ""}${cells.join(gap)}`;
}

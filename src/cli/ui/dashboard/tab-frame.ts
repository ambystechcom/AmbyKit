import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { TAB_EMPTY } from "./empty-state.js";
import { effectiveColumns, tabLayout } from "./layout.js";
import { glyph, panel } from "./panel.js";
import { renderTabBar, type TabBadges } from "./tab-bar.js";
import { TAB_TOKENS as T } from "./tab-tokens.js";
import type { Tab } from "../interactive/tabs.js";

/**
 * The tabbed frame around a tab's body (feature 032, US-1/US-3, ui.md): the tab bar, the shared filter line, then the body.
 * Everything here is a pure function of data + capabilities. The bodies themselves are the existing views, unchanged
 * (FR-003); this module only adds what the redesign introduces.
 */

export interface FilterLineInput {
  /** The search or feature text (empty when none). */
  text: string;
  /** `/` for the free-text search, `feature` for the exact feature filter. */
  label: "/" | "feature";
  /** The text is still being typed (a caret is drawn). */
  typing: boolean;
  /** The state filter in words (`blocked`), absent for every state. */
  state?: string;
  shown: number;
  total: number;
}

/** The one filter line under the tab bar (ui.md US-3); empty when nothing is typed or applied. */
export function renderFilterLine(caps: Capabilities, f: FilterLineInput): string {
  if (!f.typing && f.text === "" && f.state === undefined) return "";
  const t = T.component["filter-line"];
  const caret = f.typing ? glyph(caps, { u: "▌", a: "_" }) : "";
  const search = `${f.label} ${paintToken(caps, t["match-fg"], f.text)}${caret}`;
  const state = `s ${paintToken(caps, t["state-fg"], `state: ${f.state ?? "all"}`)}`;
  const count = paintToken(caps, t["count-fg"], `${f.shown} of ${f.total} match`);
  const none = f.shown === 0 && f.total > 0;
  const tail = none ? paintToken(caps, t["no-match-fg"], `nothing matches${caps.unicode ? " · " : ", "}esc clears it`) : paintToken(caps, t["count-fg"], "esc clear");
  return ` ${search}   ${state}   ${count}${none ? (caps.unicode ? " · " : ", ") : "   "}${tail}`;
}

/** The body for a filter that hides everything: `Nothing matches "zzz". Press esc to clear.` */
export function noMatchBody(caps: Capabilities, text: string): string[] {
  const shown = text === "" ? "" : ` "${text}"`;
  return ["", paintToken(caps, T.component["filter-line"]["no-match-fg"], `${T.word["no-match"]}${shown}. ${T.word["filter-clear"]}`)];
}

/** What a tab with nothing to show says, and how to get data (FR-002): framed on a terminal, plain lines otherwise. */
export function tabEmptyBody(caps: Capabilities, tab: Tab): string[] {
  const e = TAB_EMPTY[tab];
  const back = tab === "overview" ? "" : `   ${caps.unicode ? "»" : ">"} 1 back to overview`;
  if (tabLayout(caps) === "plain") return [tab.toUpperCase(), e.title, e.how + back];
  const width = Math.min(effectiveColumns(caps), 100);
  return panel(caps, { title: tab.toUpperCase(), width }, [e.title, paintToken(caps, T.component["metrics"]["note-fg"], e.how + back)]);
}

/** A tab whose data source failed (ui.md tab-body error): the other tabs keep working. */
export function tabErrorLine(caps: Capabilities, source: string, reason: string): string {
  const e = T.component["tab-body"].error;
  return paintToken(caps, e.fg, `${glyph(caps, e.glyph)} could not read ${source}: ${reason}`);
}

export interface TabFrameInput {
  active: Tab;
  badges?: TabBadges;
  filterLine?: string;
  body: string;
}

/** Tab bar, optional filter line, then the body. */
export function renderTabFrame(caps: Capabilities, input: TabFrameInput): string {
  return [renderTabBar(caps, { active: input.active, ...(input.badges ? { badges: input.badges } : {}) }), ...(input.filterLine ? [input.filterLine] : []), input.body].join("\n");
}

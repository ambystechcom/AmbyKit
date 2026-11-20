import type { Capabilities } from "../types.js";
import { iconMode } from "../capabilities.js";
import { TAB_TOKENS } from "./tab-tokens.js";
import { TOKENS } from "./tokens.js";

export type LayoutMode = "wide" | "narrow" | "plain";

/**
 * Pick the overview layout from terminal capabilities (ui.md "Capability states"): plain for a
 * non-TTY or a terminal narrower than `layout.min-columns`, wide from `layout.wide-min`, else narrow.
 */
export function layoutMode(caps: Capabilities): LayoutMode {
  const { "wide-min": wideMin, "min-columns": minColumns } = TOKENS.component.layout;
  if (!caps.isTTY || caps.columns < minColumns) return "plain";
  return caps.columns >= wideMin ? "wide" : "narrow";
}

/** The width to lay out for: a terminal that reports no usable size is treated as 80 columns (feature 032, ui.md US-6). */
export function effectiveColumns(caps: Capabilities): number {
  return Number.isFinite(caps.columns) && caps.columns > 0 ? caps.columns : TAB_TOKENS.space["default-columns"];
}

/**
 * Layout tier of the tabbed frame (feature 032, FR-012, FR-014): `plain` when output is not a terminal, `narrow` under
 * 029's compact breakpoint (60 columns; one breakpoint for every tab, signed-off decision 5), else `wide`.
 */
export function tabLayout(caps: Capabilities): LayoutMode {
  if (!caps.isTTY) return "plain";
  return effectiveColumns(caps) < TAB_TOKENS.component["dashboard-layout"]["narrow-max"] ? "narrow" : "wide";
}

/**
 * A glyph for the icon mode in force (feature 032, FR-013): ASCII with \`--icons=ascii\` or without unicode, else the unicode
 * form (Nerd mode reuses it until code points are verified, 029's decision). Panel edges still follow \`caps.unicode\`.
 */
export function iconGlyph(caps: Capabilities, g: { u: string; a: string }): string {
  return iconMode(caps) === "ascii" ? g.a : g.u;
}

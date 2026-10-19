import type { Capabilities } from "../types.js";
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

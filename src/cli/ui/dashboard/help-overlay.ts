import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { agentGlyph, worktreeGlyph } from "./agent-badge.js";
import { LIVE_TOKENS } from "./live-tokens.js";
import { glyph, truncateVisible, visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * Help overlay (feature 017, ui.md US-4 HelpOverlay, FR-030): the current screen's keys plus the
 * glyph legend, in a focused frame centered over the dimmed frame beneath. Pure.
 */

export type HelpScreen = "overview" | "feature" | "story";

const KEYS: Record<HelpScreen, [string, string, string][]> = {
  // [unicode key, ascii key, label]
  overview: [
    ["tab / ⇧tab", "tab / S-tab", "next / previous panel"],
    ["↑ ↓", "up / down", "move"],
    ["⏎", "enter", "open"],
    ["f", "f", "filter by feature"],
    ["s", "s", "cycle status filter"],
    ["esc", "esc", "clear filters"],
    ["r", "r", "retry live updates (when paused)"],
    ["q", "q", "quit"],
  ],
  feature: [
    ["↑ ↓", "up / down", "move"],
    ["⏎", "enter", "story detail"],
    ["esc", "esc", "back"],
    ["r", "r", "retry live updates (when paused)"],
    ["q", "q", "quit"],
  ],
  story: [
    ["↑ ↓", "up / down", "scroll tasks"],
    ["esc", "esc", "back"],
    ["r", "r", "retry live updates (when paused)"],
    ["q", "q", "quit"],
  ],
};

const LEGEND_AGENTS = ["claude", "codex", "opencode", "cursor", "copilot"];

/** The overlay's body lines: keys, a blank line, the legend, then any skipped files. */
export function helpLines(caps: Capabilities, screen: HelpScreen, skipped: string[] = []): string[] {
  const k = TOKENS.component["key-hints"];
  const keys = KEYS[screen].map(([u, a, label]) => {
    const key = caps.unicode ? u : a;
    return `${paintToken(caps, k["key-fg"], key.padEnd(12))} ${paintToken(caps, k["label-fg"], label)}`;
  });
  const t = LIVE_TOKENS.component["checkout-tag"];
  const g = (x: { u: string; a: string }) => glyph(caps, x);
  const legend = [
    `${worktreeGlyph(caps)} worktree  ${g(t.dirty.glyph)} dirty  ${caps.unicode ? g(t.stale.glyph) : "-merged"} merged  ~ detected agent`,
    LEGEND_AGENTS.map((id) => `${agentGlyph(caps, id)} ${LIVE_TOKENS.component.agent[id as "claude"].name}`).join(" "),
  ];
  const notice = skipped.length ? ["", paintToken(caps, TOKENS.component.notice.fg, "Skipped files:"), ...skipped.map((s) => `  ${s}`)] : [];
  return [...keys, "", ...legend, ...notice];
}

/** A framed box with the overlay frame tokens: title on the top edge, `footer` on the bottom edge. */
function box(caps: Capabilities, title: string, footer: string, body: string[], width: number): string[] {
  const f = LIVE_TOKENS.component.overlay.frame;
  const frame = (s: string) => paintToken(caps, f["frame-fg"], s);
  const h = glyph(caps, f["edge-h"]);
  const v = frame(glyph(caps, f["edge-v"]));
  const inner = width - 2;
  // `━ label ━━━…` filling the space between two corners.
  const fill = (label: string) => h.repeat(Math.max(0, inner - label.length - 3));
  const top =
    frame(`${glyph(caps, f["corner-tl"])}${h} `) +
    paintToken(caps, f["title-fg"], title, true) +
    frame(` ${fill(title)}${glyph(caps, f["corner-tr"])}`);
  const bottom = frame(`${glyph(caps, f["corner-bl"])}${h} ${footer} ${fill(footer)}${glyph(caps, f["corner-br"])}`);
  const rows = body.map((l) => {
    const cut = truncateVisible(caps, l, inner - 2);
    return `${v} ${cut}${" ".repeat(Math.max(0, inner - 2 - visibleWidth(cut)))} ${v}`;
  });
  return [top, ...rows, bottom];
}

/** Center `overlay` over `frame`, whose visible text is dimmed with the backdrop token. */
export function overlayOn(caps: Capabilities, frame: string, overlay: string[]): string {
  // eslint-disable-next-line no-control-regex
  const plain = frame.split("\n").map((l) => [...l.replace(/\x1b\[[0-9;]*m/g, "")]);
  const width = Math.max(caps.columns, ...overlay.map(visibleWidth));
  const w = Math.max(...overlay.map(visibleWidth));
  const x = Math.max(0, Math.floor((width - w) / 2));
  const y = Math.max(0, Math.floor((plain.length - overlay.length) / 2));
  while (plain.length < y + overlay.length) plain.push([]);
  const dim = (chars: string[]) => (chars.length ? paintToken(caps, LIVE_TOKENS.component.overlay.backdrop, chars.join("")) : "");
  return plain
    .map((chars, i) => {
      const o = overlay[i - y];
      if (o === undefined) return dim(chars);
      const left = chars.slice(0, x);
      while (left.length < x) left.push(" ");
      return dim(left) + o + dim(chars.slice(x + w));
    })
    .join("\n");
}

/** The overlay for `screen`, drawn over `frame`. */
export function renderHelp(caps: Capabilities, frame: string, screen: HelpScreen, skipped: string[] = []): string {
  const body = helpLines(caps, screen, skipped);
  const width = Math.min(caps.columns, Math.max(51, ...body.map((l) => visibleWidth(l) + 4)));
  return overlayOn(caps, frame, box(caps, `KEYS${caps.unicode ? " · " : " - "}${screen}`, "any key to close", body, width));
}

import type { Capabilities, Glyph, Symbols } from "./types.js";

/**
 * The palette + glyphs, mirroring specs/006-enhanced-tui/design-tokens.json. `paint` applies ANSI
 * only when `Capabilities.color`; `symbols`/`spinnerFrames` pick unicode vs ASCII by
 * `Capabilities.unicode`. This is the one place that emits color, replacing banner.ts's ad-hoc
 * `useColor()` (constitution Principle 2).
 */

const ESC = "\x1b[";

/** ANSI SGR parameters (primitive.sgr in the token file). */
const SGR = {
  reset: "0",
  bold: "1",
  dim: "2",
  fgDefault: "39",
  fgCyan: "36",
  fgGreen: "32",
  fgYellow: "33",
  fgRed: "31",
  fgMagenta: "35",
  fgGray: "90",
} as const;

/** Semantic style names → SGR parameter lists (semantic.color + message.heading weight). */
export type Style = "accent" | "success" | "warn" | "danger" | "muted" | "text" | "heading";

const STYLE_SGR: Record<Style, readonly string[]> = {
  accent: [SGR.fgCyan],
  success: [SGR.fgGreen],
  warn: [SGR.fgYellow],
  danger: [SGR.fgRed],
  muted: [SGR.dim],
  text: [SGR.fgDefault],
  heading: [SGR.fgCyan, SGR.bold],
};

/** Glyph pairs (primitive.glyph). */
const GLYPHS = {
  tick: { u: "✓", a: "[ok]" },
  bang: { u: "!", a: "!" },
  cross: { u: "✗", a: "x" },
  barFill: { u: "█", a: "#" },
  barEmpty: { u: "░", a: "-" },
  cursor: { u: "▸", a: ">" },
  checked: { u: "◉", a: "(*)" },
  unchecked: { u: "◯", a: "( )" },
  arrow: { u: "→", a: "->" },
} as const satisfies Record<string, Glyph>;

/** Spinner frame sets (primitive.glyph.spinner). */
const SPINNER: { u: readonly string[]; a: readonly string[] } = {
  u: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  a: ["-", "\\", "|", "/"],
};

/** Wrap `s` in the given style's ANSI codes, or return it unchanged when color is disabled. */
export function paint(caps: Capabilities, style: Style, s: string): string {
  if (!caps.color) return s;
  const codes = STYLE_SGR[style].join(";");
  return `${ESC}${codes}m${s}${ESC}${SGR.reset}m`;
}

/** The resolved symbol set for the current capabilities (unicode or ASCII fallback). */
export function symbols(caps: Capabilities): Symbols {
  const pick = (g: Glyph): string => (caps.unicode ? g.u : g.a);
  return {
    success: pick(GLYPHS.tick),
    warn: pick(GLYPHS.bang),
    error: pick(GLYPHS.cross),
    barFill: pick(GLYPHS.barFill),
    barEmpty: pick(GLYPHS.barEmpty),
    cursor: pick(GLYPHS.cursor),
    checked: pick(GLYPHS.checked),
    unchecked: pick(GLYPHS.unchecked),
    nextStep: pick(GLYPHS.arrow),
  };
}

/** The spinner frame set for the current capabilities. */
export function spinnerFrames(caps: Capabilities): readonly string[] {
  return caps.unicode ? SPINNER.u : SPINNER.a;
}

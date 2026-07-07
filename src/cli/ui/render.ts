import type { Capabilities } from "./types.js";
import { paint, symbols } from "./theme.js";

/**
 * Message renderers — the single styling surface behind `BaseCommand` (constitution Principle 2).
 * Every kind carries a distinct glyph **and** word so meaning survives `NO_COLOR`/monochrome
 * terminals (never color-only). `info` is a deliberate plain passthrough so `--json` and other
 * machine output stay byte-identical (FR-009/010).
 */

/** Plain passthrough — no styling, ever. Guards machine-output fidelity. */
export function info(s: string): string {
  return s;
}

/** A section heading in the accent color (bold). */
export function heading(caps: Capabilities, s: string): string {
  return paint(caps, "heading", s);
}

/** Success line: `✓ text`. */
export function success(caps: Capabilities, s: string): string {
  return `${paint(caps, "success", symbols(caps).success)} ${s}`;
}

/** Warning line: `! text` — visually distinct from both info and error. */
export function warn(caps: Capabilities, s: string): string {
  return `${paint(caps, "warn", symbols(caps).warn)} ${s}`;
}

/**
 * Error line: `✗ text`, optionally followed by an indented, muted next-step hint (`→ …`).
 * The next-step arg is wired into call sites in US-5 (FR-008); the styling is defined here so the
 * treatment stays consistent.
 */
export function error(caps: Capabilities, s: string, next?: string): string {
  const sym = symbols(caps);
  let out = `${paint(caps, "danger", sym.error)} ${s}`;
  if (next) out += `\n  ${paint(caps, "muted", `${sym.nextStep} ${next}`)}`;
  return out;
}

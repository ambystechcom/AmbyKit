import { detectCapabilities } from "./capabilities.js";
import { paint } from "./theme.js";
import type { Capabilities } from "./types.js";

const ART = [
  "  ▄▀█ █▀▄▀█ █▄▄ █▄█ █▄▀ █ ▀█▀",
  "  █▀█ █░▀░█ █▄█ ░█░ █░█ █ ░█░",
];

/** The AmbyKit ASCII banner (with a tagline), colorized per the terminal's capabilities. */
export function banner(caps: Capabilities = detectCapabilities()): string {
  const art = ART.map((l) => paint(caps, "accent", l)).join("\n");
  const tagline = paint(caps, "muted", "  Spec-Driven Development for AI coding assistants");
  return `\n${art}\n${tagline}\n`;
}

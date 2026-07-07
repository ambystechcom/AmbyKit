import type { Capabilities } from "../../src/cli/ui/types.js";

/** Strip ANSI SGR sequences so assertions can compare plain text. */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** True if the string contains any ANSI escape sequence. */
export function hasAnsi(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x1b\[/.test(s);
}

/** A fully-featured Capabilities object for tests; override fields per case. */
export function fakeCapabilities(overrides: Partial<Capabilities> = {}): Capabilities {
  return { isTTY: true, color: true, unicode: true, columns: 80, ...overrides };
}

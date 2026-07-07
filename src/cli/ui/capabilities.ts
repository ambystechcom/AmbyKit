import type { Capabilities } from "./types.js";

/** Minimal stdout shape we read from — keeps `detectCapabilities` injectable in tests. */
export interface StdoutLike {
  isTTY?: boolean;
  columns?: number;
}

export interface DetectInput {
  env?: NodeJS.ProcessEnv;
  stdout?: StdoutLike;
}

const DEFAULT_COLUMNS = 80;

/**
 * Detect terminal capabilities once, from injected `env`/`stdout` (defaults to the real process).
 * Conservative by design: when a signal is missing we fall to the safe side (no color / ASCII), and
 * a non-TTY forces both off regardless of locale — satisfying FR-002/003/007/012 and the
 * data-model invariant that `color` and `unicode` are false whenever `isTTY` is false.
 */
export function detectCapabilities(input: DetectInput = {}): Capabilities {
  const env = input.env ?? process.env;
  const stdout: StdoutLike = input.stdout ?? process.stdout;

  const isTTY = Boolean(stdout.isTTY);

  // NO_COLOR standard: present and non-empty disables color (empty string is treated as unset).
  const noColor = env["NO_COLOR"] != null && env["NO_COLOR"] !== "";
  const dumb = env["TERM"] === "dumb";
  const color = isTTY && !noColor && !dumb;

  const columns =
    typeof stdout.columns === "number" && stdout.columns > 0 ? stdout.columns : DEFAULT_COLUMNS;

  const unicode = isTTY && supportsUnicode(env);

  return { isTTY, color, unicode, columns };
}

/** Heuristic unicode detection — no portable runtime query exists, so infer from env, else false. */
function supportsUnicode(env: NodeJS.ProcessEnv): boolean {
  if (env["WT_SESSION"]) return true; // Windows Terminal
  const program = env["TERM_PROGRAM"];
  if (program === "vscode" || program === "Apple_Terminal" || program === "iTerm.app") return true;
  const locale = env["LC_ALL"] || env["LC_CTYPE"] || env["LANG"] || "";
  return /UTF-?8/i.test(locale);
}

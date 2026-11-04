import { emitKeypressEvents } from "node:readline";
import type { Capabilities } from "../types.js";
import { paint, symbols } from "../theme.js";

/**
 * Interactive multi-select (US-7). The reducer + renderer are pure and unit-testable; only
 * `multiSelect` touches stdin/stdout. Callers MUST gate on `caps.isTTY` — when a required selection
 * is missing on a non-TTY, the command errors with guidance instead of calling this (FR-016).
 */

export interface PromptOption {
  value: string;
  label: string;
}

export interface PromptState {
  options: PromptOption[];
  cursor: number;
  selected: Set<number>;
  done: boolean;
  cancelled: boolean;
  /** Viewport height in options (feature 016, FR-013); equals `options.length` when everything fits. */
  rows: number;
  /** Index of the first visible option. */
  top: number;
}

export type PromptKey = "up" | "down" | "space" | "enter" | "escape";

export function initPromptState(options: PromptOption[], preselected: string[] = [], rows?: number): PromptState {
  const selected = new Set<number>();
  options.forEach((o, i) => {
    if (preselected.includes(o.value)) selected.add(i);
  });
  const height = Math.max(1, Math.min(rows ?? options.length, options.length));
  return { options, cursor: 0, selected, done: false, cancelled: false, rows: height, top: 0 };
}

/** Viewport rows for a terminal `termRows` tall: leave room for the message, two hints and a margin. */
export function viewportRows(optionCount: number, termRows: number | undefined): number {
  return Math.max(3, Math.min(optionCount, (termRows ?? 24) - 6));
}

/** Slide the window just enough to keep the cursor visible. */
function scrolled(state: PromptState, cursor: number): PromptState {
  let { top } = state;
  if (cursor < top) top = cursor;
  else if (cursor >= top + state.rows) top = cursor - state.rows + 1;
  return { ...state, cursor, top };
}

/** Pure state transition — `(state, key) → state`. */
export function reducePrompt(state: PromptState, key: PromptKey): PromptState {
  const n = state.options.length;
  switch (key) {
    case "up":
      return scrolled(state, (state.cursor - 1 + n) % n);
    case "down":
      return scrolled(state, (state.cursor + 1) % n);
    case "space": {
      const selected = new Set(state.selected);
      if (selected.has(state.cursor)) selected.delete(state.cursor);
      else selected.add(state.cursor);
      return { ...state, selected };
    }
    case "enter":
      return { ...state, done: true };
    case "escape":
      return { ...state, done: true, cancelled: true };
  }
}

/** The selected option values, in option order. */
export function selectedValues(state: PromptState): string[] {
  return state.options.filter((_, i) => state.selected.has(i)).map((o) => o.value);
}

/** Number of lines `renderPromptLines` produces. It is constant while the user scrolls, so redraws stay aligned. */
export function promptHeight(state: PromptState): number {
  return 1 + state.rows + (state.rows < state.options.length ? 2 : 0);
}

/**
 * Render the prompt as an array of lines (pure): one message line, then the visible options. When
 * the list is taller than the viewport, a `↑ n more` line above and a `↓ n more` line below (blank
 * when nothing is hidden that way) show what is off-screen; with everything visible the output is
 * exactly one line per option.
 */
export function renderPromptLines(caps: Capabilities, message: string, state: PromptState): string[] {
  const sym = symbols(caps);
  const hint = paint(caps, "muted", "(space toggle · enter confirm · esc cancel)");
  const lines = [`${paint(caps, "accent", "?")} ${message}   ${hint}`];
  const windowed = state.rows < state.options.length;
  const hidden = (n: number, arrow: string): string => (n > 0 ? "  " + paint(caps, "muted", `${arrow} ${n} more`) : "");
  if (windowed) lines.push(hidden(state.top, caps.unicode ? "↑" : "^"));
  for (let i = state.top; i < Math.min(state.options.length, state.top + state.rows); i++) {
    const opt = state.options[i]!;
    const cursor = i === state.cursor ? paint(caps, "accent", sym.cursor) : " ";
    const box = state.selected.has(i) ? sym.checked : sym.unchecked;
    lines.push(`  ${cursor} ${box} ${opt.label}`);
  }
  if (windowed) lines.push(hidden(state.options.length - state.top - state.rows, caps.unicode ? "↓" : "v"));
  return lines;
}

interface OutputLike {
  write(s: string): unknown;
  /** Terminal height; sizes the option viewport. */
  rows?: number;
}

/**
 * Run the interactive prompt. Resolves to the selected values, or `null` if the user cancels (esc).
 * Precondition: `caps.isTTY` (callers gate on it).
 */
export function multiSelect(
  caps: Capabilities,
  args: { message: string; options: PromptOption[]; preselected?: string[] },
  io: { input: NodeJS.ReadStream; output: OutputLike } = { input: process.stdin, output: process.stdout },
): Promise<string[] | null> {
  const { input, output } = io;
  let state = initPromptState(args.options, args.preselected, viewportRows(args.options.length, output.rows));

  const lineCount = promptHeight(state);
  const draw = (first: boolean): void => {
    if (!first) output.write(`\x1b[${lineCount}A`); // move up to overwrite the previous render
    for (const line of renderPromptLines(caps, args.message, state)) output.write(`\r\x1b[K${line}\n`);
  };

  emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);
  input.setRawMode?.(true);
  input.resume();

  return new Promise((resolve) => {
    const cleanup = (): void => {
      input.off("keypress", onKey);
      input.setRawMode?.(wasRaw);
      input.pause();
    };
    const onKey = (_str: string, key: { name?: string; ctrl?: boolean } = {}): void => {
      const mapped = mapKey(key);
      if (!mapped) return;
      state = reducePrompt(state, mapped);
      if (state.done) {
        cleanup();
        resolve(state.cancelled ? null : selectedValues(state));
        return;
      }
      draw(false);
    };
    input.on("keypress", onKey);
    draw(true);
  });
}

/**
 * Single-key yes/no question (feature 012, FR-011a). Resolves to the answer, or `defaultValue` on
 * enter; `null` on esc / ctrl-c. Precondition: `caps.isTTY` (callers gate on it).
 */
export function confirm(
  caps: Capabilities,
  args: { message: string; defaultValue?: boolean },
  io: { input: NodeJS.ReadStream; output: OutputLike } = { input: process.stdin, output: process.stdout },
): Promise<boolean | null> {
  const { input, output } = io;
  const def = args.defaultValue ?? false;
  const hint = def ? "Y/n" : "y/N";
  output.write(`${paint(caps, "accent", "?")} ${args.message} ${paint(caps, "muted", `(${hint})`)} `);

  emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);
  input.setRawMode?.(true);
  input.resume();

  return new Promise((resolve) => {
    const finish = (value: boolean | null): void => {
      input.off("keypress", onKey);
      input.setRawMode?.(wasRaw);
      input.pause();
      output.write(`${value === null ? "" : value ? "yes" : "no"}\n`);
      resolve(value);
    };
    const onKey = (str: string, key: { name?: string; ctrl?: boolean } = {}): void => {
      if (key.ctrl && key.name === "c") return finish(null);
      if (key.name === "escape") return finish(null);
      if (key.name === "return" || key.name === "enter") return finish(def);
      const ch = (str ?? "").toLowerCase();
      if (ch === "y") return finish(true);
      if (ch === "n") return finish(false);
    };
    input.on("keypress", onKey);
  });
}

function mapKey(key: { name?: string; ctrl?: boolean }): PromptKey | null {
  if (key.ctrl && key.name === "c") return "escape";
  switch (key.name) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "space":
      return "space";
    case "return":
    case "enter":
      return "enter";
    case "escape":
      return "escape";
    default:
      return null;
  }
}

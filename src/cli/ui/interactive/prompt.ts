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
}

export type PromptKey = "up" | "down" | "space" | "enter" | "escape";

export function initPromptState(options: PromptOption[], preselected: string[] = []): PromptState {
  const selected = new Set<number>();
  options.forEach((o, i) => {
    if (preselected.includes(o.value)) selected.add(i);
  });
  return { options, cursor: 0, selected, done: false, cancelled: false };
}

/** Pure state transition — `(state, key) → state`. */
export function reducePrompt(state: PromptState, key: PromptKey): PromptState {
  const n = state.options.length;
  switch (key) {
    case "up":
      return { ...state, cursor: (state.cursor - 1 + n) % n };
    case "down":
      return { ...state, cursor: (state.cursor + 1) % n };
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

/** Render the prompt as an array of lines (pure) — one message line + one line per option. */
export function renderPromptLines(caps: Capabilities, message: string, state: PromptState): string[] {
  const sym = symbols(caps);
  const hint = paint(caps, "muted", "(space toggle · enter confirm · esc cancel)");
  const lines = [`${paint(caps, "accent", "?")} ${message}   ${hint}`];
  state.options.forEach((opt, i) => {
    const cursor = i === state.cursor ? paint(caps, "accent", sym.cursor) : " ";
    const box = state.selected.has(i) ? sym.checked : sym.unchecked;
    lines.push(`  ${cursor} ${box} ${opt.label}`);
  });
  return lines;
}

interface OutputLike {
  write(s: string): unknown;
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
  let state = initPromptState(args.options, args.preselected);

  const lineCount = args.options.length + 1;
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

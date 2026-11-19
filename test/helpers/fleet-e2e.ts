import { EventEmitter } from "node:events";
import { stripAnsi, fakeCapabilities } from "../ui/helpers.js";

/**
 * Shared pieces for the Fleet view end-to-end tests (feature 029): the real `DashboardCommand` on fake stdin/stdout.
 * Each test file keeps its own `vi.mock` lines (they must be hoisted there) and points `io.current` at the terminal
 * built here; only the terminal, the agent-process scan and the update check are faked.
 */

export const io: { current: null | { input: NodeJS.ReadStream; output: { write(s: string): unknown } } } = { current: null };

export function fakeTerminal(columns = 120) {
  const frames: string[] = [];
  const output = Object.assign(new EventEmitter(), { columns, write: (s: string) => (frames.push(stripAnsi(s)), true) });
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    setRawMode: () => {},
    resume: () => {},
    pause: () => {},
  }) as unknown as NodeJS.ReadStream;
  io.current = { input, output };
  return {
    frames,
    input,
    output,
    /** The last frame, or "" before any. */
    last: () => frames.at(-1) ?? "",
    press: (name: string, extra: { sequence?: string; shift?: boolean } = {}) =>
      input.emit("keypress", "", { name, sequence: name.length === 1 ? name : undefined, ...extra }),
    /** A shifted letter as readline reports it: name lower-case, sequence upper-case. */
    pressShift: (letter: string) => input.emit("keypress", "", { name: letter.toLowerCase(), sequence: letter.toUpperCase(), shift: true }),
  };
}

export async function until(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return cond();
}

export function capsFor(overrides: Record<string, unknown> = {}) {
  return fakeCapabilities({ color: false, columns: 120, ...overrides });
}

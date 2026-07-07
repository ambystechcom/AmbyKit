import { emitKeypressEvents } from "node:readline";

/**
 * Generic full-screen host (US-6). Enters the alternate screen buffer + raw mode, drives a pure
 * `reduce`/`render`/`isDone` app, and **guarantees** the terminal is restored on quit, Ctrl-C, or
 * SIGINT/SIGTERM (FR-013). Callers must gate on `caps.isTTY` and fall back to one-shot output
 * otherwise (FR-014) — this host assumes an interactive terminal.
 */

export interface KeyEvent {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
}

export interface FullscreenApp<S> {
  initial: S;
  render(state: S): string;
  reduce(state: S, key: KeyEvent): S;
  isDone(state: S): boolean;
}

interface OutputLike {
  write(s: string): unknown;
}

const ENTER = "\x1b[?1049h\x1b[?25l"; // alt screen + hide cursor
const EXIT = "\x1b[?25h\x1b[?1049l"; // show cursor + leave alt screen

/** Run the app to completion; resolves with the final state. */
export function runFullscreen<S>(
  app: FullscreenApp<S>,
  io: { input: NodeJS.ReadStream; output: OutputLike } = { input: process.stdin, output: process.stdout },
): Promise<S> {
  const { input, output } = io;
  let state = app.initial;

  const frame = (): void => output.write(`\x1b[2J\x1b[H${app.render(state)}`) as unknown as void;

  emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);

  return new Promise<S>((resolve) => {
    let finished = false;
    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      input.off("keypress", onKey);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      input.setRawMode?.(wasRaw);
      input.pause();
      output.write(EXIT);
    };
    const finish = (): void => {
      cleanup();
      resolve(state);
    };
    const onKey = (_s: string, key: KeyEvent = {}): void => {
      if (key.ctrl && key.name === "c") return finish();
      state = app.reduce(state, key);
      if (app.isDone(state)) return finish();
      frame();
    };
    const onSignal = (): void => finish();

    input.setRawMode?.(true);
    input.resume();
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    output.write(ENTER);
    frame();
    input.on("keypress", onKey);
  });
}

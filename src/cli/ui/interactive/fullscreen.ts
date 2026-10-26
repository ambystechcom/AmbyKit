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
  shift?: boolean;
  sequence?: string;
}

export interface FullscreenApp<S> {
  initial: S;
  render(state: S): string;
  reduce(state: S, key: KeyEvent): S;
  isDone(state: S): boolean;
  /**
   * Optional: called once after the first frame with an `update` that applies a state change and
   * redraws — for work that arrives after startup (feature 014: the burndown fills in place).
   */
  start?(update: (fn: (state: S) => S) => void): void;
  /** Optional: called on terminal resize, before the redraw (feature 017, FR-013). */
  resize?(columns: number): void;
  /** Optional: release watchers/timers; called once on every exit path (feature 017, FR-016). */
  stop?(): void;
}

interface OutputLike {
  write(s: string): unknown;
  columns?: number;
  on?(event: "resize", listener: () => void): unknown;
  off?(event: "resize", listener: () => void): unknown;
}

const ENTER = "\x1b[?1049h\x1b[?25l"; // alt screen + hide cursor
const EXIT = "\x1b[?25h\x1b[?1049l"; // show cursor + leave alt screen

/**
 * One frame, repainted in place (feature 017): cursor home, each line followed by erase-to-end-of-line,
 * then erase below. Unlike a full clear this never flashes, which matters once frames arrive unprompted.
 */
export function frameText(body: string): string {
  return `\x1b[H${body.split("\n").join("\x1b[K\n")}\x1b[K\x1b[J`;
}

/** Run the app to completion; resolves with the final state. */
export function runFullscreen<S>(
  app: FullscreenApp<S>,
  io: { input: NodeJS.ReadStream; output: OutputLike } = { input: process.stdin, output: process.stdout },
): Promise<S> {
  const { input, output } = io;
  let state = app.initial;

  const frame = (): void => output.write(frameText(app.render(state))) as unknown as void;

  emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);

  return new Promise<S>((resolve) => {
    let finished = false;
    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      input.off("keypress", onKey);
      output.off?.("resize", onResize);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      input.setRawMode?.(wasRaw);
      input.pause();
      try {
        app.stop?.();
      } finally {
        output.write(EXIT);
      }
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
    const onResize = (): void => {
      if (finished) return;
      app.resize?.(output.columns ?? 80);
      frame();
    };

    input.setRawMode?.(true);
    input.resume();
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    output.write(ENTER);
    frame();
    input.on("keypress", onKey);
    output.on?.("resize", onResize);
    app.start?.((fn) => {
      if (finished) return;
      state = fn(state);
      if (app.isDone(state)) return finish();
      frame();
    });
  });
}

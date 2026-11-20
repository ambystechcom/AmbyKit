import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { frameText, runFullscreen, type FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";

/**
 * The full-screen host repaints only when the frame changed (flicker fix). The heartbeat re-renders every few seconds
 * and most of those frames are identical, so writing them made the terminal flash.
 */

interface S {
  text: string;
  done: boolean;
}

function io() {
  const written: string[] = [];
  const output = Object.assign(new EventEmitter(), { columns: 80, write: (s: string) => (written.push(s), true) });
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    setRawMode: () => {},
    resume: () => {},
    pause: () => {},
  }) as unknown as NodeJS.ReadStream;
  return { written, output, input };
}

const frames = (written: string[]): string[] => written.filter((w) => w.startsWith("\x1b[H"));

describe("full-screen host repaints only changed frames", () => {
  it("does not write a frame identical to the one on screen", async () => {
    const { written, output, input } = io();
    let push: ((fn: (s: S) => S) => void) | null = null;
    const app: FullscreenApp<S> = {
      initial: { text: "A", done: false },
      render: (s) => s.text,
      reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : s),
      isDone: (s) => s.done,
      start: (update) => {
        push = update;
      },
    };
    const done = runFullscreen(app, { input, output });
    push!((s) => ({ ...s })); // same text: a quiet heartbeat
    push!((s) => ({ ...s }));
    expect(frames(written)).toEqual([frameText("A")]);
    push!((s) => ({ ...s, text: "B" })); // a real change repaints
    expect(frames(written)).toEqual([frameText("A"), frameText("B")]);
    push!((s) => ({ ...s, text: "B" }));
    expect(frames(written)).toHaveLength(2);
    input.emit("keypress", "", { name: "q" });
    await done;
  });

  it("a key that changes nothing on screen writes nothing", async () => {
    const { written, output, input } = io();
    const app: FullscreenApp<S> = {
      initial: { text: "A", done: false },
      render: (s) => s.text,
      reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : s),
      isDone: (s) => s.done,
    };
    const done = runFullscreen(app, { input, output });
    input.emit("keypress", "", { name: "x" });
    input.emit("keypress", "", { name: "y" });
    expect(frames(written)).toHaveLength(1);
    input.emit("keypress", "", { name: "q" });
    await done;
  });

  it("a resize repaints even when the text is unchanged", async () => {
    const { written, output, input } = io();
    const app: FullscreenApp<S> = {
      initial: { text: "A", done: false },
      render: (s) => s.text,
      reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : s),
      isDone: (s) => s.done,
    };
    const done = runFullscreen(app, { input, output });
    output.emit("resize");
    expect(frames(written)).toHaveLength(2);
    input.emit("keypress", "", { name: "q" });
    await done;
  });
});

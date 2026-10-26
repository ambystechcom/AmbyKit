import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { frameText, runFullscreen, type FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";

describe("runFullscreen host (FR-013)", () => {
  it("enters the alt screen, restores it on quit, and toggles raw mode", async () => {
    const written: string[] = [];
    const output = { write: (s: string) => (written.push(s), true) };
    const rawCalls: boolean[] = [];
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      setRawMode: (m: boolean) => void rawCalls.push(m),
      resume: () => {},
      pause: () => {},
    }) as unknown as NodeJS.ReadStream;

    const app: FullscreenApp<{ n: number; done: boolean }> = {
      initial: { n: 0, done: false },
      render: (s) => `frame ${s.n}`,
      reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : { ...s, n: s.n + 1 }),
      isDone: (s) => s.done,
    };

    const done = runFullscreen(app, { input, output });
    input.emit("keypress", "", { name: "down" }); // advances a frame
    input.emit("keypress", "", { name: "q" }); // quits
    const final = await done;

    expect(final.n).toBe(1);
    const all = written.join("");
    expect(all).toContain("\x1b[?1049h"); // entered alt screen
    expect(all).toContain("\x1b[?1049l"); // restored normal screen
    expect(rawCalls).toEqual([true, false]); // raw mode on then restored
  });
});

describe("runFullscreen host — live hooks (feature 017, FR-013/FR-016)", () => {
  const ESC = "\x1b";

  function fakeIo() {
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

  it("repaints in place (no full clear) and redraws with the new width on resize", async () => {
    const { written, output, input } = fakeIo();
    let cols = 0;
    const app: FullscreenApp<{ done: boolean }> = {
      initial: { done: false },
      render: () => `cols ${cols}`,
      reduce: (s, k) => (k.name === "q" ? { done: true } : s),
      isDone: (s) => s.done,
      resize: (c) => void (cols = c),
    };
    const done = runFullscreen(app, { input, output });
    output.columns = 132;
    output.emit("resize");
    input.emit("keypress", "", { name: "q" });
    await done;
    const all = written.join("");
    expect(all).not.toContain(`${ESC}[2J`);
    expect(all).toContain(`cols 132${ESC}[K${ESC}[J`);
    expect(output.listenerCount("resize")).toBe(0);
  });

  it("calls stop() exactly once on quit and Ctrl-C", async () => {
    for (const quit of ["q", "ctrl-c"] as const) {
      const { output, input } = fakeIo();
      let stops = 0;
      const app: FullscreenApp<{ done: boolean }> = {
        initial: { done: false },
        render: () => "x",
        reduce: (s, k) => (k.name === "q" ? { done: true } : s),
        isDone: (s) => s.done,
        stop: () => void stops++,
      };
      const done = runFullscreen(app, { input, output });
      if (quit === "q") input.emit("keypress", "", { name: "q" });
      else input.emit("keypress", "", { name: "c", ctrl: true });
      await done;
      expect(stops, quit).toBe(1);
    }
  });

  it("frameText erases each line's tail and everything below", () => {
    expect(frameText("a\nb")).toBe(`${ESC}[Ha${ESC}[K\nb${ESC}[K${ESC}[J`);
  });
});

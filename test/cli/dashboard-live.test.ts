import { EventEmitter } from "node:events";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { tick, worktreeProject } from "../helpers/worktree-fixture.js";
import { fakeCapabilities, stripAnsi } from "../ui/helpers.js";

/**
 * Live interactive dashboard end to end (feature 017, US-2): the real command, real `fs.watch` and a
 * real worktree, with only the terminal faked. SC-002 (a tick shows up within 1 s), FR-016/SC-006
 * (everything stops on exit) and FR-017 (no monitoring outside interactive mode).
 */

const io = vi.hoisted(() => ({ current: null as null | { input: NodeJS.ReadStream; output: { write(s: string): unknown } } }));
const watchers = vi.hoisted(() => ({ created: 0, stopped: 0 }));

vi.mock("../../src/cli/ui/interactive/fullscreen.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/cli/ui/interactive/fullscreen.js")>();
  return { ...real, runFullscreen: <S>(app: FullscreenApp<S>) => real.runFullscreen(app, io.current as never) };
});
vi.mock("../../src/cli/ui/interactive/live.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/cli/ui/interactive/live.js")>();
  return {
    ...real,
    watchProject: (...args: Parameters<typeof real.watchProject>) => {
      watchers.created++;
      const w = real.watchProject(...args);
      return {
        get mode() {
          return w.mode;
        },
        stop: () => {
          watchers.stopped++;
          w.stop();
        },
      };
    },
  };
});
// No process scan or update check in tests: both would spawn or reach out.
vi.mock("../../src/cli/ui/interactive/agent-scan.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/cli/ui/interactive/agent-scan.js")>()),
  listAgentProcesses: async () => [],
}));
vi.mock("../../src/cli/ui/callout.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/cli/ui/callout.js")>()),
  outdatedWarning: async () => "",
}));

const { DashboardCommand } = await import("../../src/cli/dashboard.js");

function fakeTerminal() {
  const frames: string[] = [];
  const output = Object.assign(new EventEmitter(), { columns: 120, write: (s: string) => (frames.push(stripAnsi(s)), true) });
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    setRawMode: () => {},
    resume: () => {},
    pause: () => {},
  }) as unknown as NodeJS.ReadStream;
  io.current = { input, output };
  return { frames, input, press: (name: string) => input.emit("keypress", "", { name }) };
}

async function until(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return cond();
}

function command(columns = 120) {
  const cmd = new DashboardCommand();
  (cmd as unknown as { caps: unknown }).caps = fakeCapabilities({ color: false, columns });
  return cmd;
}

afterEach(() => {
  watchers.created = watchers.stopped = 0;
});

describe.skipIf(!HAS_GIT)("live interactive dashboard (feature 017, US-2)", () => {
  it("a task ticked in a worktree repaints within 1 s, and quitting stops all monitoring (SC-002, FR-016)", async () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    const term = fakeTerminal();
    const run = command().run({ cwd: root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((f) => f.includes("WORKTREES & AGENTS")), 5000)).toBe(true);
    expect(term.frames.at(-1)).toMatch(/● live/);
    expect(watchers.created).toBe(1);

    const t0 = Date.now();
    tick(join(root, ".worktrees", "002-b"), "002-b", 7);
    expect(await until(() => /002 b .*70%/.test(term.frames.at(-1) ?? ""), 1000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);

    term.press("q");
    expect(await run).toBe(0);
    expect(watchers.stopped).toBe(watchers.created);
    const after = term.frames.length;
    tick(join(root, ".worktrees", "002-b"), "002-b", 9);
    await new Promise((r) => setTimeout(r, 400));
    expect(term.frames.length).toBe(after); // nothing repaints once stopped
  }, 20_000);

  it("a new worktree appears without restarting (FR-011)", async () => {
    const root = worktreeProject(["001-a", "002-b"], []);
    const term = fakeTerminal();
    const run = command().run({ cwd: root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((f) => f.includes("No feature worktrees yet")), 5000)).toBe(true);
    const { addWorktree } = await import("../helpers/worktree-fixture.js");
    addWorktree(root, "002-b");
    // Within a heartbeat at most: files checked out after the re-arm are caught by the heartbeat re-check.
    expect(await until(() => /WORKTREES & AGENTS · 1/.test(term.frames.at(-1) ?? ""), 7000)).toBe(true);
    term.press("q");
    await run;
    expect(watchers.stopped).toBe(watchers.created);
  }, 20_000);

  it("30 simulated minutes of heartbeats leak no watchers or timers (SC-006)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
      const term = fakeTerminal();
      const run = command().run({ cwd: root, positionals: [], flags: { interactive: true } });
      expect(await until(() => term.frames.some((f) => f.includes("WORKTREES & AGENTS")), 5000)).toBe(true);
      expect(vi.getTimerCount()).toBe(1); // the heartbeat
      for (let i = 0; i < 360; i++) await vi.advanceTimersByTimeAsync(5000);
      expect(watchers.created).toBe(1); // no re-arm churn while nothing changes
      expect(vi.getTimerCount()).toBe(1);
      term.press("q");
      await run;
      expect(watchers.stopped).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);

  it("one-shot and JSON modes create no watcher (FR-017)", async () => {
    const root = worktreeProject(["001-a"], []);
    const orig = console.log;
    console.log = () => {};
    try {
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: {} });
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: { json: true, overview: true } });
      // --interactive off a TTY falls back to one-shot.
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: { interactive: true } });
    } finally {
      console.log = orig;
    }
    expect(watchers.created).toBe(0);
  });
});

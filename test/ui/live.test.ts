import { describe, expect, it } from "vitest";
import { isRelevant, watchProject, watchTargets, type WatchDeps, type WatchTarget } from "../../src/cli/ui/interactive/live.js";

/** watchProject with fake fs and timers (feature 017, US-2: FR-010/011/015/016, SC-006). */

function fakeDeps(opts: { watchThrows?: boolean; signatureThrows?: () => boolean } = {}) {
  const listeners = new Map<string, (event: string, filename: string | null) => void>();
  const errorHandlers: ((e: Error) => void)[] = [];
  const timers = new Map<number, { fn: () => void; at: number; every?: number }>();
  let id = 0;
  let now = 0;
  let sig = "a";
  const closed: string[] = [];
  const deps: WatchDeps = {
    watch: (path, _o, listener) => {
      if (opts.watchThrows) throw Object.assign(new Error("nope"), { code: "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM" });
      listeners.set(path, listener);
      return { close: () => void closed.push(path), on: (_e, l) => void errorHandlers.push(l) };
    },
    exists: () => true,
    signature: () => {
      if (opts.signatureThrows?.()) throw new Error("EACCES");
      return sig;
    },
    setTimeout: (fn, ms) => (timers.set(++id, { fn, at: now + ms }), id),
    clearTimeout: (t) => void timers.delete(t as number),
    setInterval: (fn, ms) => (timers.set(++id, { fn, at: now + ms, every: ms }), id),
    clearInterval: (t) => void timers.delete(t as number),
  };
  const advance = (ms: number): void => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [tid, t] = due;
      now = t.at;
      if (t.every) t.at += t.every;
      else timers.delete(tid);
      t.fn();
    }
    now = end;
  };
  return {
    deps,
    listeners,
    errorHandlers,
    timers,
    closed,
    advance,
    setSig: (s: string) => void (sig = s),
  };
}

const targets: WatchTarget[] = [
  { path: "/p/specs", recursive: true },
  { path: "/p/.worktrees", recursive: false, anyEntry: true },
];

describe("watchProject (feature 017, US-2)", () => {
  it("watches each checkout's specs and markers, and .worktrees", () => {
    const t = watchTargets({
      primary: { root: "/p", kind: "main" },
      worktrees: [{ feature: "002-b", checkout: { root: "/p/.worktrees/002-b", kind: "worktree" } }],
    }).map((x) => x.path.replace(/\\/g, "/"));
    expect(t).toEqual(["/p/specs", "/p/.amby/activity", "/p/.worktrees", "/p", "/p/.worktrees/002-b/specs/002-b", "/p/.worktrees/002-b/.amby/activity"]);
  });

  it("the project root only counts `.worktrees` appearing", () => {
    const f = fakeDeps();
    let changes = 0;
    watchProject([{ path: "/p", recursive: false, only: [".worktrees"] }], () => changes++, f.deps);
    f.listeners.get("/p")!("rename", "README.md");
    f.advance(200);
    expect(changes).toBe(0);
    f.listeners.get("/p")!("rename", ".worktrees");
    f.advance(200);
    expect(changes).toBe(1);
  });

  it("only markdown and marker files count, except inside .worktrees", () => {
    expect(isRelevant("002-b/tasks.md")).toBe(true);
    expect(isRelevant("002-b.claude.json")).toBe(true);
    expect(isRelevant("node_modules/x.js")).toBe(false);
    expect(isRelevant(null)).toBe(true);
  });

  it("debounce coalesces a burst into one change (FR-010)", () => {
    const f = fakeDeps();
    let changes = 0;
    const w = watchProject(targets, () => changes++, f.deps, { debounceMs: 150 });
    expect(w.mode).toBe("watching");
    const specs = f.listeners.get("/p/specs")!;
    specs("change", "002-b/tasks.md");
    f.advance(50);
    specs("change", "002-b/spec.md");
    specs("change", "002-b/x.ts"); // ignored
    f.advance(149);
    expect(changes).toBe(0);
    f.advance(1);
    expect(changes).toBe(1);
    f.listeners.get("/p/.worktrees")!("rename", "003-c"); // a worktree appeared (FR-011)
    f.advance(150);
    expect(changes).toBe(2);
  });

  it("a throwing watch falls back to polling mtimes (FR-015)", () => {
    const f = fakeDeps({ watchThrows: true });
    let changes = 0;
    const modes: string[] = [];
    const w = watchProject(targets, () => changes++, f.deps, { pollMs: 2000, onMode: (m) => modes.push(m) });
    expect(w.mode).toBe("polling");
    expect(modes).toEqual(["polling"]);
    f.advance(2000);
    expect(changes).toBe(0);
    f.setSig("b");
    f.advance(2000);
    expect(changes).toBe(1);
  });

  it("a runtime watcher error switches to polling and closes the watchers", () => {
    const f = fakeDeps();
    const w = watchProject(targets, () => {}, f.deps);
    f.errorHandlers[0]!(new Error("EPERM"));
    expect(w.mode).toBe("polling");
    expect(f.closed.sort()).toEqual(["/p/.worktrees", "/p/specs"]);
  });

  it("polling that fails pauses monitoring", () => {
    let fail = false;
    const f = fakeDeps({ watchThrows: true, signatureThrows: () => fail });
    const w = watchProject(targets, () => {}, f.deps, { pollMs: 1000 });
    fail = true;
    f.advance(1000);
    expect(w.mode).toBe("paused");
    expect(f.timers.size).toBe(0);
  });

  it("stop() closes every watcher and clears every timer (FR-016, SC-006)", () => {
    const f = fakeDeps();
    let changes = 0;
    const w = watchProject(targets, () => changes++, f.deps);
    f.listeners.get("/p/specs")!("change", "a.md");
    w.stop();
    expect(f.closed.length).toBe(2);
    expect(f.timers.size).toBe(0);
    f.advance(10_000);
    expect(changes).toBe(0);
    w.stop(); // idempotent

    const p = fakeDeps({ watchThrows: true });
    const pw = watchProject(targets, () => {}, p.deps);
    expect(p.timers.size).toBe(1);
    pw.stop();
    expect(p.timers.size).toBe(0);
  });
});

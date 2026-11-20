import { describe, expect, it } from "vitest";
import { fleetWatchTargets, liveTargets, targetsSignature, watchProject, watchTargets, type WatchDeps, type WatchTarget } from "../../src/cli/ui/interactive/live.js";

/** Fleet directory watching (feature 029, FR-002): a change under `.amby/fleet` refreshes; polling covers it too. */

const checkouts = { primary: { root: "/p", kind: "main" as const }, worktrees: [], lanes: [] };
const norm = (t: WatchTarget[]) => t.map((x) => x.path.replace(/\\/g, "/"));

function fakeDeps() {
  const listeners = new Map<string, (event: string, filename: string | null) => void>();
  const timers = new Map<number, { fn: () => void; at: number; every?: number }>();
  let id = 0;
  let now = 0;
  let sig = "a";
  const deps: WatchDeps = {
    watch: (path, _o, listener) => {
      listeners.set(path, listener);
      return { close: () => {}, on: () => {} };
    },
    exists: () => true,
    signature: () => sig,
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
  return { deps, listeners, advance, setSig: (s: string) => void (sig = s) };
}

describe("fleet directory watching (feature 029)", () => {
  it("029:FR-002: the fleet directory is a recursive watch target in the primary checkout", () => {
    expect(fleetWatchTargets(checkouts)).toEqual([{ path: expect.stringMatching(/\.amby[\\/]fleet$/), recursive: true }]);
  });

  it("029:FR-002: liveTargets adds it after the 017 targets, which are unchanged", () => {
    expect(norm(liveTargets(checkouts)).slice(0, norm(watchTargets(checkouts)).length)).toEqual(norm(watchTargets(checkouts)));
    expect(norm(liveTargets(checkouts)).at(-1)).toBe("/p/.amby/fleet");
  });

  it("029:FR-002: a run.json or directive change under the fleet directory triggers one refresh", () => {
    const f = fakeDeps();
    let changes = 0;
    watchProject(fleetWatchTargets(checkouts), () => changes++, f.deps, { debounceMs: 10 });
    const listener = [...f.listeners.entries()].find(([p]) => p.replace(/\\/g, "/").endsWith(".amby/fleet"))![1];
    listener("change", "demo.1/run.json");
    listener("change", "demo.1/directives/lane-1-1.json");
    f.advance(50);
    expect(changes).toBe(1);
  });

  it("029:FR-002: the polling fallback covers it when watching is unavailable", () => {
    const f = fakeDeps();
    const deps: WatchDeps = { ...f.deps, watch: () => { throw new Error("ERR_FEATURE_UNAVAILABLE_ON_PLATFORM"); } };
    let changes = 0;
    const w = watchProject(fleetWatchTargets(checkouts), () => changes++, deps, { pollMs: 100 });
    expect(w.mode).toBe("polling");
    f.setSig("b");
    f.advance(150);
    expect(changes).toBe(1);
  });

  it("029:FR-002: the signature changes when the fleet directory first appears, so the dashboard re-arms", () => {
    const before = targetsSignature(fleetWatchTargets(checkouts), () => false);
    const after = targetsSignature(fleetWatchTargets(checkouts), () => true);
    expect(before).not.toBe(after);
  });
});

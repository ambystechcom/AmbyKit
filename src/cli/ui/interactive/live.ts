import { existsSync, readdirSync, statSync, watch as fsWatch } from "node:fs";
import { join } from "node:path";
import { ACTIVITY_DIR } from "../../../core/activity.js";
import type { ProjectCheckouts } from "../../../core/checkouts.js";
import { WORKTREES_DIR } from "../../../core/worktree.js";
import { LIVE_TOKENS } from "../dashboard/live-tokens.js";

/**
 * Change notification for the interactive dashboard (feature 017, US-2). Watches each checkout's
 * specs and activity markers plus `.worktrees/`, debounces bursts into one `onChange`, and falls back
 * to mtime polling when `fs.watch` is unavailable (FR-015). Only `interactive()` constructs it (FR-017).
 * All IO goes through `WatchDeps` so tests can drive it with fakes.
 */

export interface WatchTarget {
  path: string;
  recursive: boolean;
  /** `.worktrees/` itself: any entry change counts (a worktree added or removed, FR-011). */
  anyEntry?: boolean;
  /** Only these entry names count (the project root, watched just for `.worktrees` appearing). */
  only?: string[];
}

interface Closable {
  close(): void;
  on?(event: "error", listener: (err: Error) => void): unknown;
}

type Timer = unknown;

export interface WatchDeps {
  watch(path: string, opts: { recursive: boolean }, listener: (event: string, filename: string | null) => void): Closable;
  exists(path: string): boolean;
  /** A cheap signature of the relevant files under `target` (mtimes), for polling. */
  signature(target: WatchTarget): string;
  setTimeout(fn: () => void, ms: number): Timer;
  clearTimeout(t: Timer): void;
  setInterval(fn: () => void, ms: number): Timer;
  clearInterval(t: Timer): void;
}

export type WatchMode = "watching" | "polling" | "paused";

export interface ProjectWatcher {
  readonly mode: WatchMode;
  stop(): void;
}

export interface WatchOptions {
  debounceMs?: number;
  pollMs?: number;
  /** Called when the mode changes (polling fallback, or paused when monitoring fails). */
  onMode?: (mode: WatchMode) => void;
}

/** What to watch: specs (a worktree's own feature only) and markers per checkout, plus `.worktrees/`. */
export function watchTargets(c: ProjectCheckouts): WatchTarget[] {
  const targets: WatchTarget[] = [
    { path: join(c.primary.root, "specs"), recursive: true },
    { path: join(c.primary.root, ACTIVITY_DIR), recursive: false },
    { path: join(c.primary.root, WORKTREES_DIR), recursive: false, anyEntry: true },
    { path: c.primary.root, recursive: false, only: [WORKTREES_DIR] },
  ];
  for (const wt of c.worktrees) {
    targets.push(
      { path: join(wt.checkout.root, "specs", wt.feature), recursive: true },
      { path: join(wt.checkout.root, ACTIVITY_DIR), recursive: false },
    );
  }
  return targets;
}

/**
 * Which targets exist right now. Watching starts only on existing paths, so when this changes (a
 * worktree's files were checked out after we armed) the caller re-arms.
 */
export function targetsSignature(targets: WatchTarget[], exists: (p: string) => boolean = existsSync): string {
  return targets.map((t) => `${t.path}:${exists(t.path) ? 1 : 0}`).join("|");
}

/** Feature artifacts are markdown; activity markers are json. Unknown names (null) count. */
export function isRelevant(filename: string | null): boolean {
  return filename === null || /\.(md|json)$/i.test(filename);
}

export function watchProject(targets: WatchTarget[], onChange: () => void, deps: WatchDeps = nodeDeps, opts: WatchOptions = {}): ProjectWatcher {
  const debounceMs = opts.debounceMs ?? LIVE_TOKENS.time["debounce-ms"];
  const pollMs = opts.pollMs ?? LIVE_TOKENS.time["poll-s"] * 1000;
  let mode: WatchMode = "watching";
  let stopped = false;
  let pending: Timer | null = null;
  let poller: Timer | null = null;
  let watchers: Closable[] = [];

  const setMode = (m: WatchMode): void => {
    if (mode === m) return;
    mode = m;
    opts.onMode?.(m);
  };

  const fire = (): void => {
    if (stopped) return;
    if (pending !== null) deps.clearTimeout(pending);
    pending = deps.setTimeout(() => {
      pending = null;
      if (!stopped) onChange();
    }, debounceMs);
  };

  const closeWatchers = (): void => {
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        /* already closed */
      }
    }
    watchers = [];
  };

  const startPolling = (): void => {
    closeWatchers();
    setMode("polling");
    const sign = (): string => targets.map((t) => deps.signature(t)).join("|");
    let last: string;
    try {
      last = sign();
    } catch {
      setMode("paused");
      return;
    }
    poller = deps.setInterval(() => {
      if (stopped) return;
      try {
        const next = sign();
        if (next !== last) {
          last = next;
          onChange();
        }
      } catch {
        if (poller !== null) deps.clearInterval(poller);
        poller = null;
        setMode("paused");
      }
    }, pollMs);
  };

  try {
    for (const t of targets) {
      if (!deps.exists(t.path)) continue; // created later: caught by a `.worktrees`/specs re-arm on refresh
      const w = deps.watch(t.path, { recursive: t.recursive }, (_event, filename) => {
        if (t.only ? filename !== null && t.only.includes(filename) : t.anyEntry || isRelevant(filename)) fire();
      });
      w.on?.("error", () => {
        if (!stopped && mode === "watching") startPolling();
      });
      watchers.push(w);
    }
  } catch {
    startPolling(); // e.g. ERR_FEATURE_UNAVAILABLE_ON_PLATFORM for recursive watch
  }

  return {
    get mode() {
      return mode;
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (pending !== null) deps.clearTimeout(pending);
      if (poller !== null) deps.clearInterval(poller);
      pending = poller = null;
      closeWatchers();
    },
  };
}

// --- node implementation ---

function walkSignature(dir: string, recursive: boolean, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) walkSignature(p, true, out);
    } else if (isRelevant(e.name)) {
      out.push(`${p}:${statSync(p).mtimeMs}`);
    }
  }
}

export const nodeDeps: WatchDeps = {
  watch: (path, opts, listener) => fsWatch(path, { recursive: opts.recursive, persistent: false }, (event, filename) => listener(event, filename ? String(filename) : null)),
  exists: existsSync,
  signature: (t) => {
    if (!existsSync(t.path)) return `${t.path}:-`;
    if (t.only) return `${t.path}:${t.only.filter((n) => existsSync(join(t.path, n))).join(",")}`;
    if (t.anyEntry) return `${t.path}:${readdirSync(t.path).sort().join(",")}`;
    const out: string[] = [];
    walkSignature(t.path, t.recursive, out);
    return out.sort().join(",");
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t as NodeJS.Timeout),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (t) => clearInterval(t as NodeJS.Timeout),
};

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Lockfiles and atomic writes (feature 025, data-model "Locks"). `.amby/locks/<name>.lock` is created
 * exclusively with the owner's pid and time; a lock older than 30 s is stale and taken over. Callers
 * retry briefly and then get a warning: a lock never hangs the agent (FR-012).
 */

export const LOCK_DIR = join(".amby", "locks");
export const STALE_LOCK_MS = 30_000;
const RETRY_MS = 15;
const WAIT_MS = 2_000;

export type Locked<T> = { ok: true; value: T } | { ok: false; warning: string };

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** File-name-safe lock name for an arbitrary path or id. */
export function lockName(raw: string): string {
  return raw.replace(/[^a-z0-9._-]+/gi, "_").slice(-120) || "lock";
}

/** Run `fn` while holding `<root>/.amby/locks/<name>.lock`. */
export function withLock<T>(root: string, name: string, fn: () => T, opts: { waitMs?: number; staleMs?: number } = {}): Locked<T> {
  const dir = join(root, LOCK_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) {
    try {
      writeFileSync(ignore, "# AmbyKit lock files (local only)\n*\n", "utf8");
    } catch {
      /* another writer won the race */
    }
  }
  const path = join(dir, `${lockName(name)}.lock`);
  const deadline = Date.now() + (opts.waitMs ?? WAIT_MS);
  const staleMs = opts.staleMs ?? STALE_LOCK_MS;
  for (;;) {
    try {
      const fd = openSync(path, "wx");
      try {
        writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      } finally {
        closeSync(fd);
      }
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return { ok: false, warning: `could not lock ${name}: ${(err as Error).message}` };
      if (isStale(path, staleMs)) {
        rmSync(path, { force: true });
        continue;
      }
      if (Date.now() >= deadline) return { ok: false, warning: `${name} is busy (locked by another writer); try again` };
      sleep(RETRY_MS);
    }
  }
  try {
    return { ok: true, value: fn() };
  } finally {
    rmSync(path, { force: true });
  }
}

function isStale(path: string, staleMs: number): boolean {
  try {
    const body = JSON.parse(readFileSync(path, "utf8")) as { at?: string };
    const at = body.at ? Date.parse(body.at) : NaN;
    if (!Number.isNaN(at)) return Date.now() - at > staleMs;
  } catch {
    /* unreadable or half-written: fall through to the file's own age */
  }
  try {
    return Date.now() - statSync(path).mtimeMs > staleMs;
  } catch {
    return false; // vanished: the next exclusive create decides
  }
}

/** Write to a temp file and rename it over `path`, so a reader never sees half a file. */
export function writeFileAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
  writeFileSync(tmp, data, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, path);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt < 5 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
        sleep(10 * (attempt + 1)); // Windows: a reader may briefly hold the target
        continue;
      }
      rmSync(tmp, { force: true });
      throw err;
    }
  }
}

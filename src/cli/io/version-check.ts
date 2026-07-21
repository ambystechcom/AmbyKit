import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Latest-version lookup for feature 010. The hot path (`latestFromCache`) is a single sync read — no
 * network. `refreshLatest` is a best-effort, timeout-bounded registry fetch that updates the cache;
 * it never throws and never hangs. Cache dir is `~/.ambykit/` (override with `AMBYKIT_CACHE_DIR` — used
 * in tests). This is a tool-managed cache, not a project write (Principle 7).
 */

export interface VersionCache {
  latest: string;
  checkedAt: string; // ISO-8601
}

const PACKAGE = "@ambystech/ambykit";
const TTL_MS = 24 * 60 * 60 * 1000; // 1 day (FR-005a)

function cacheFile(): string {
  const dir = process.env["AMBYKIT_CACHE_DIR"] || join(homedir(), ".ambykit");
  return join(dir, "version-cache.json");
}

function readCache(): VersionCache | null {
  try {
    const file = cacheFile();
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<VersionCache>;
    if (typeof parsed.latest === "string" && typeof parsed.checkedAt === "string") {
      return { latest: parsed.latest, checkedAt: parsed.checkedAt };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(cache: VersionCache): void {
  try {
    const file = cacheFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(cache), "utf8");
  } catch {
    // best-effort — a cache we can't write just means we look up again next time.
  }
}

/** Pure staleness check: missing/invalid timestamp or older than the TTL ⇒ stale. */
export function isStale(checkedAt: string | null, now: number, ttlMs: number = TTL_MS): boolean {
  if (!checkedAt) return true;
  const age = now - new Date(checkedAt).getTime();
  return Number.isNaN(age) || age < 0 || age >= ttlMs;
}

/** Sync read of the cached latest version; null when missing/unreadable. The hot path uses ONLY this. */
export function latestFromCache(): string | null {
  return readCache()?.latest ?? null;
}

/** True when the cache is missing or older than 24h (authorizes a refresh). */
export function cacheIsStale(): boolean {
  return isStale(readCache()?.checkedAt ?? null, Date.now());
}

/** Best-effort registry lookup with a timeout; writes the cache on success; null on any failure. */
export async function refreshLatest(timeoutMs = 500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE}/latest`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    const latest = typeof data.version === "string" ? data.version : null;
    if (latest) writeCache({ latest, checkedAt: new Date().toISOString() });
    return latest;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

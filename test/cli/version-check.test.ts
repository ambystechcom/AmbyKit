import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cacheIsStale,
  isStale,
  latestFromCache,
  refreshLatest,
} from "../../src/cli/io/version-check.js";

function useTempCache(): string {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-vc-"));
  process.env["AMBYKIT_CACHE_DIR"] = dir;
  return dir;
}
function writeCacheFile(dir: string, cache: object): void {
  writeFileSync(join(dir, "version-cache.json"), JSON.stringify(cache), "utf8");
}

afterEach(() => {
  delete process.env["AMBYKIT_CACHE_DIR"];
  vi.unstubAllGlobals();
});

describe("isStale (pure, FR-005a)", () => {
  const now = Date.parse("2026-07-21T00:00:00Z");
  it("is stale when missing, older than TTL, future, or unparseable", () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale("2026-07-19T00:00:00Z", now)).toBe(true); // 2 days old
    expect(isStale("2026-07-22T00:00:00Z", now)).toBe(true); // future
    expect(isStale("not-a-date", now)).toBe(true);
  });
  it("is fresh within the TTL", () => {
    expect(isStale("2026-07-20T13:00:00Z", now)).toBe(false); // 11h old
  });
});

describe("latestFromCache / cacheIsStale", () => {
  it("reads a fresh cache and reports it not stale", () => {
    const dir = useTempCache();
    writeCacheFile(dir, { latest: "1.2.3", checkedAt: new Date().toISOString() });
    expect(latestFromCache()).toBe("1.2.3");
    expect(cacheIsStale()).toBe(false);
  });

  it("returns null and stale when there is no cache", () => {
    useTempCache();
    expect(latestFromCache()).toBeNull();
    expect(cacheIsStale()).toBe(true);
  });
});

describe("refreshLatest (best-effort, never throws)", () => {
  it("fetches, returns the version, and writes the cache", async () => {
    useTempCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "9.9.9" }) })));
    expect(await refreshLatest(200)).toBe("9.9.9");
    expect(latestFromCache()).toBe("9.9.9"); // persisted
  });

  it("returns null on a non-ok response", async () => {
    useTempCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await refreshLatest(200)).toBeNull();
  });

  it("returns null when the request throws/aborts (offline)", async () => {
    useTempCache();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect(await refreshLatest(200)).toBeNull();
    expect(latestFromCache()).toBeNull(); // nothing cached on failure
  });

  it("the warning and update share one source of truth for latest (FR-012)", async () => {
    // The lookup writes the cache; the warning reads exactly what the lookup produced — one module,
    // so the callout (latestFromCache) and update (refreshLatest) can never disagree.
    useTempCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "5.5.5" }) })));
    expect(await refreshLatest(200)).toBe("5.5.5");
    expect(latestFromCache()).toBe("5.5.5");
  });
});

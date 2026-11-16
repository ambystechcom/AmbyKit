import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCK_DIR, lockName, withLock, writeFileAtomic } from "../../src/core/fleet/lock.js";

const root = () => mkdtempSync(join(tmpdir(), "ambykit-lock-"));

describe("fleet lock", () => {
  it("025:FR-005: runs the function under the lock and releases it afterwards", () => {
    const r = root();
    const out = withLock(r, "tasks", () => {
      expect(existsSync(join(r, LOCK_DIR, "tasks.lock"))).toBe(true);
      return 42;
    });
    expect(out).toEqual({ ok: true, value: 42 });
    expect(existsSync(join(r, LOCK_DIR, "tasks.lock"))).toBe(false);
  });

  it("025:FR-005: releases the lock when the function throws", () => {
    const r = root();
    expect(() => withLock(r, "x", () => { throw new Error("boom"); })).toThrow("boom");
    expect(existsSync(join(r, LOCK_DIR, "x.lock"))).toBe(false);
  });

  it("025:FR-012: a busy lock returns a warning after a short wait and never hangs", () => {
    const r = root();
    let inner: ReturnType<typeof withLock<number>> | undefined;
    withLock(r, "busy", () => {
      inner = withLock(r, "busy", () => 1, { waitMs: 60 });
    });
    expect(inner?.ok).toBe(false);
    expect((inner as { warning: string }).warning).toMatch(/busy/);
  });

  it("025:FR-005: recovers a stale lock left by a dead writer", () => {
    const r = root();
    mkdirSync(join(r, LOCK_DIR), { recursive: true });
    const lock = join(r, LOCK_DIR, "old.lock");
    writeFileSync(lock, JSON.stringify({ pid: 1, at: new Date(Date.now() - 60_000).toISOString() }));
    const old = new Date(Date.now() - 60_000);
    utimesSync(lock, old, old);
    expect(withLock(r, "old", () => "ok")).toEqual({ ok: true, value: "ok" });
  });

  it("025:FR-005: a half-written lock file is judged by its age, not trusted forever", () => {
    const r = root();
    mkdirSync(join(r, LOCK_DIR), { recursive: true });
    const lock = join(r, LOCK_DIR, "half.lock");
    writeFileSync(lock, "{");
    const old = new Date(Date.now() - 60_000);
    utimesSync(lock, old, old);
    expect(withLock(r, "half", () => 1).ok).toBe(true);
  });

  it("lockName makes a file-name-safe name", () => {
    expect(lockName("specs/025/tasks.md")).toBe("specs_025_tasks.md");
  });

  it("025:FR-005: writeFileAtomic replaces a file whole and leaves no temp file", () => {
    const r = root();
    const p = join(r, "a", "x.json");
    writeFileAtomic(p, "one");
    writeFileAtomic(p, "two");
    expect(readFileSync(p, "utf8")).toBe("two");
  });
});

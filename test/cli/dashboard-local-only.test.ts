import { afterEach, describe, expect, it, vi } from "vitest";
import { HAS_GIT } from "../helpers/git-repo.js";
import { gitHistoryFixture } from "../helpers/git-history-fixture.js";

/**
 * FR-001 / SC-004: the dashboard computes everything locally — it reads `specs/*` files and, for the
 * burndown, runs read-only git commands. No network request, no other process.
 */
const { calls } = vi.hoisted(() => ({ calls: [] as string[][] }));
vi.mock("node:child_process", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:child_process")>();
  const record =
    <F extends (...a: never[]) => unknown>(fn: F) =>
    (...args: Parameters<F>) => {
      calls.push([String(args[0]), ...((args[1] as unknown as string[]) ?? [])]);
      return fn(...args);
    };
  return { ...real, execFileSync: record(real.execFileSync), execFile: record(real.execFile), spawn: record(real.spawn) };
});

afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});

describe.skipIf(!HAS_GIT)("dashboard is local-only (FR-001, SC-004)", () => {
  it("uses only read-only git subcommands and never the network", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network disabled")));
    vi.stubGlobal("fetch", fetchSpy);
    const root = gitHistoryFixture("001-x", [
      { date: "2026-08-03", done: 0, total: 4 },
      { date: "2026-08-12", done: 2 },
    ]);
    calls.length = 0; // ignore fixture setup
    const { DashboardCommand } = await import("../../src/cli/dashboard.js");
    const orig = console.log;
    console.log = () => {};
    try {
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: {} });
      await new DashboardCommand().run({ cwd: root, positionals: [], flags: { json: true, overview: true } });
    } finally {
      console.log = orig;
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(calls.length).toBeGreaterThan(0);
    for (const [bin, ...args] of calls) {
      expect(bin).toBe("git");
      expect(["--version", "rev-parse", "log", "cat-file", "worktree"]).toContain(args[0]);
      if (args[0] === "worktree") expect(args[1]).toBe("list"); // 017: discover feature worktrees
    }
  });
});

import { createRequire } from "node:module";
import { expect } from "vitest";
import { scaledBudget } from "./machine-load.js";

// The real child_process, loaded without the module graph: this file is imported by the `vi.mock("node:child_process")`
// factory, so a static import of it here would wait on the factory that is waiting on this file.
const realChildProcess = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");

/**
 * Load-independent "stays under 1 s" checks, shared by the dashboard budget tests (017 worktrees, 030 v2 reader, 032).
 *
 * A single wall-clock sample measures how busy the machine is as much as the command: during a full parallel suite run
 * every sample of the largest fixture was 1.0-1.4 s, and a shared CI runner is slower still. So the guarantee is two
 * checks that do not depend on load:
 *  1. WORK: the command starts at most `spawnBudget` child processes (its cost is dominated by git spawns, so an
 *     accidental extra git call per feature or worktree fails this deterministically);
 *  2. TIME: the fastest sample finishes under the budget, OR within a few multiples of what the same number of bare
 *     `git --version` spawns costs right now on this machine (so a loaded or slow machine does not fail, while code that
 *     gets slower for the same number of spawns still does).
 *
 * Counting spawns needs `vi.mock("node:child_process", ...)` in the test file itself (vitest hoists it per file):
 *
 *   vi.mock("node:child_process", async (importOriginal) =>
 *     (await import("../helpers/load-independent-budget.js")).countingChildProcess(await importOriginal()));
 */

/** Child-process spawns seen since the process started; read the delta around a run. */
export const spawned = { n: 0 };

/** Wrap `node:child_process` so every spawn is counted while still running for real. */
export function countingChildProcess<T extends typeof import("node:child_process")>(real: T): T {
  return {
    ...real,
    execFile: ((...a: Parameters<T["execFile"]>) => (spawned.n++, (real.execFile as (...x: unknown[]) => unknown)(...a))) as T["execFile"],
    execFileSync: ((...a: Parameters<T["execFileSync"]>) => (spawned.n++, (real.execFileSync as (...x: unknown[]) => unknown)(...a))) as T["execFileSync"],
  };
}

export interface Sample {
  ms: number;
  spawns: number;
}

/** Time one call and the child-process spawns it made. */
export async function sample(fn: () => Promise<unknown>): Promise<Sample> {
  const before = spawned.n;
  const t0 = performance.now();
  await fn();
  return { ms: performance.now() - t0, spawns: spawned.n - before };
}

export interface BudgetOptions {
  /** Hard ceiling on spawns per run (measured value plus about a third of headroom). */
  spawnBudget: number;
  /** The wall-clock budget, default 1000 ms. */
  budgetMs?: number;
  /** Timed runs after one untimed warm-up, default 3. */
  runs?: number;
  /** Runs the command once and may assert on its result (called for the warm-up and every timed run). */
  run: () => Promise<unknown>;
  label: string;
}

/**
 * Warm up once, take `runs` samples, assert the spawn bound and then the time bound (see the file comment).
 * Returns the best sample so a test can log it.
 */
export async function expectWithinBudget(o: BudgetOptions): Promise<Sample> {
  const budgetMs = o.budgetMs ?? 1000;
  await o.run(); // untimed warm-up: module load and git's own caches
  const samples: Sample[] = [];
  for (let i = 0; i < (o.runs ?? 3); i++) samples.push(await sample(o.run));
  const spawns = Math.max(...samples.map((s) => s.spawns));
  expect(spawns, `${o.label}: git/child-process spawns per run`).toBeLessThanOrEqual(o.spawnBudget);
  const best = samples.reduce((a, b) => (b.ms < a.ms ? b : a));
  if (best.ms >= budgetMs) {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) realChildProcess.execFileSync("git", ["--version"], { stdio: "ignore" });
    const perSpawn = (performance.now() - t0) / 10;
    // 3x the spawn floor plus fixed work (module load, layout), or the budget stretched by how slow the CPU is right now:
    // the command's JavaScript slows down under load too, not only its git spawns (a second suite at once measured 1.7 s).
    const allowed = Math.max(Math.max(spawns, 1) * perSpawn * 3 + 250, scaledBudget(budgetMs));
    expect(best.ms, `${o.label}: best of ${samples.length} ${Math.round(best.ms)} ms, ${spawns} spawns at ${perSpawn.toFixed(1)} ms each`).toBeLessThan(allowed);
  }
  return best;
}

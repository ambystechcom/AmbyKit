import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// Vitest's default is one worker per core minus one. On a 32-core machine that is 31 workers, and the git-heavy suites
// (worktrees, lanes, fleets, metrics history) each spawn git over and over, so 31 workers made every one of those tests
// about twice as slow as with 16 (summed test time 1150 s against 624 s) for no gain in wall time (52 s against 48 s),
// and a second suite or a build running alongside pushed tests past their timeouts. 12 workers keeps the suite within a few
// seconds of the fastest setting and stayed green with two full suites running at once. Small machines (a 4-core CI
// runner) keep the default, so the cap never reduces their parallelism.
const WORKER_CAP = 12;
const maxWorkers = Math.min(WORKER_CAP, Math.max(1, availableParallelism() - 1));

export default defineConfig({
  // The official plugins (plugins/<name>/test) import the published surface by its package name; resolve those names to this
  // checkout's source so their tests run without a build and always test the core of the same commit.
  resolve: {
    alias: [
      { find: /^@ambystech\/ambykit\/plugin$/, replacement: src("plugins/index.ts") },
      { find: /^@ambystech\/ambykit\/testkit$/, replacement: src("testkit/index.ts") },
    ],
  },
  test: {
    maxWorkers,
    // Feature worktrees and lanes live under .worktrees/ (feature 012/015); their copies of the suite are not ours to run.
    exclude: [...configDefaults.exclude, ".worktrees/**"],
    // Several suites spawn real git processes (worktree, burndown, lanes, fleets). Most tests take 1-10 s with the machine
    // idle and take twice that when it is busy; a timeout is not an assertion, so it is generous (the shared CI runners
    // have timed out at 20 s on tests that pass alone).
    testTimeout: 40_000,
    hookTimeout: 40_000,
  },
});

import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

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
    // Feature worktrees and lanes live under .worktrees/ (feature 012/015); their copies of the suite are not ours to run.
    exclude: [...configDefaults.exclude, ".worktrees/**"],
    // Several suites spawn real git processes (worktree, burndown, read-only checks). On the Windows
    // CI runner that is slow, and vitest 5 runs more files in parallel, so the 5 s default is too tight.
    testTimeout: 20_000,
  },
});

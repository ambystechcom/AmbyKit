import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Feature worktrees and lanes live under .worktrees/ (feature 012/015); their copies of the suite are not ours to run.
    exclude: [...configDefaults.exclude, ".worktrees/**"],
    // Several suites spawn real git processes (worktree, burndown, read-only checks). On the Windows
    // CI runner that is slow, and vitest 5 runs more files in parallel, so the 5 s default is too tight.
    testTimeout: 20_000,
  },
});

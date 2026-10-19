import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Several suites spawn real git processes (worktree, burndown, read-only checks). On the Windows
    // CI runner that is slow, and vitest 5 runs more files in parallel, so the 5 s default is too tight.
    testTimeout: 20_000,
  },
});

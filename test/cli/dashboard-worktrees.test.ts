import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { worktreePerfFixture } from "../helpers/dashboard-perf-fixture.js";
import { tick, worktreeProject } from "../helpers/worktree-fixture.js";
import { stripAnsi } from "../ui/helpers.js";
import { join } from "node:path";

/** Run the dashboard capturing stdout; tests run without a TTY, so output is the plain layout. */
async function capture(cwd: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.error = (...a: unknown[]) => void lines.push(a.join(" "));
  let code: number;
  try {
    code = await new DashboardCommand().run({ cwd, positionals: [], flags });
  } finally {
    console.log = orig.log;
    console.error = orig.error;
  }
  return { code, out: stripAnsi(lines.join("\n")) };
}

describe.skipIf(!HAS_GIT)("dashboard across worktrees (feature 017, US-1)", () => {
  it("shows worktree progress identically from main and from inside the worktree (SC-001)", async () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    tick(join(root, ".worktrees", "002-b"), "002-b", 4);
    const fromMain = await capture(root);
    const fromWorktree = await capture(join(root, ".worktrees", "002-b"));
    expect(fromMain.code).toBe(0);
    expect(fromMain.out).toContain("TASKS 4/20");
    expect(fromMain.out).toMatch(/002 b .*40%.* wt\*/);
    expect(fromMain.out).toContain("WORKTREES & AGENTS");
    expect(fromWorktree.out).toBe(fromMain.out);
  });

  it("without worktrees there is no tag, panel, or checkout noise (FR-008)", async () => {
    const { out } = await capture(worktreeProject(["001-a", "002-b"]));
    expect(out).not.toContain("WORKTREES");
    expect(out).not.toMatch(/  wt[ *]/); // the plain checkout tag
    expect(out).not.toContain("CHECKOUT & AGENT");
  });

  it("--feature reads the story tasks from the worktree (FR-006)", async () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    tick(join(root, ".worktrees", "002-b"), "002-b", 3);
    const { out } = await capture(root, { feature: "002" });
    expect(out).toContain("30%");
    expect(out).toMatch(/CHECKOUT & AGENT .*002-b - dirty/);
  });

  it("--json --overview names each feature's source checkout without local paths (FR-007)", async () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    const { out } = await capture(root, { json: true, overview: true });
    const json = JSON.parse(out) as { features: { name: string; checkout: Record<string, unknown> }[] };
    expect(json.features.find((f) => f.name === "001-a")?.checkout).toEqual({ kind: "main" });
    expect(json.features.find((f) => f.name === "002-b")?.checkout).toEqual({ kind: "worktree", branch: "002-b", dirty: false, stale: false });
  });

  it("one-shot shows a self-reported agent from its worktree marker (FR-018, FR-021)", async () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    const wt = join(root, ".worktrees", "002-b");
    const { ActivityCommand } = await import("../../src/cli/activity.js");
    await new ActivityCommand().run({ cwd: wt, positionals: ["002"], flags: { agent: "codex", phase: "implement", task: "T003" } });
    const { out } = await capture(root);
    expect(out).toMatch(/002 b +wt 002-b +\[CX\] Codex +implement T003 +active now/);
    expect(out).toMatch(/002 b .*\[CX\]$/m); // the feature chart's agent column
  });

  it("--icons rejects unknown modes", async () => {
    const { code, out } = await capture(worktreeProject(["001-a"]), { icons: "emoji" });
    expect(code).toBe(1);
    expect(out).toContain("--icons expects nerd, unicode or ascii");
  });

  it("one-shot with 10 worktrees / 50 features stays under 1 s (SC-003)", async () => {
    const root = worktreePerfFixture(50, 10);
    const t0 = performance.now();
    const { code, out } = await capture(root);
    const ms = performance.now() - t0;
    expect(code).toBe(0);
    expect(out.match(/  wt\*/g)?.length).toBe(10);
    expect(ms).toBeLessThan(1000);
  }, 60_000);
});

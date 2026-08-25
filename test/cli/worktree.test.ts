import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorktreeCommand } from "../../src/cli/worktree.js";
import { branchExists, currentBranch, worktreeList } from "../../src/core/git.js";
import { HAS_GIT, gitProject, gitRun } from "../helpers/git-repo.js";

/** Run the verb, capturing stdout/stderr text. */
async function wt(cwd: string, positionals: string[], flags: Record<string, string | boolean> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const [oLog, oErr, oWarn] = [console.log, console.error, console.warn];
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await new WorktreeCommand().run({ cwd, positionals, flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    [console.log, console.error, console.warn] = [oLog, oErr, oWarn];
  }
}

describe.skipIf(!HAS_GIT)("ambykit worktree (feature 012)", () => {
  it("creates .worktrees/<id> on a new branch from main and ignores the dir (FR-002, FR-003, SC-002)", async () => {
    const root = gitProject(["003-foo"]);
    const before = gitRun(root, ["status", "--porcelain"]);
    const r = await wt(root, ["003-foo"], { json: true });
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j).toMatchObject({ action: "created", feature: "003-foo", branch: "003-foo", newBranch: true, base: "main" });
    expect(existsSync(join(root, ".worktrees", "003-foo", "specs", "003-foo", "spec.md"))).toBe(true);
    expect(currentBranch(join(root, ".worktrees", "003-foo"))).toBe("003-foo");
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toContain(".worktrees/");
    // Main checkout untouched except the new .gitignore (which is the only allowed side effect).
    expect(currentBranch(root)).toBe("main");
    const after = gitRun(root, ["status", "--porcelain"]).split("\n").filter(Boolean);
    expect(after).toEqual(before ? [...before.split("\n"), "?? .gitignore"] : ["?? .gitignore"]);
  });

  it("checks out an existing branch instead of creating one (FR-003)", async () => {
    const root = gitProject(["003-foo"]);
    gitRun(root, ["branch", "003-foo"]);
    const r = await wt(root, ["003-foo"], { json: true });
    expect(JSON.parse(r.out)).toMatchObject({ action: "created", newBranch: false, base: null });
  });

  it("is a no-op the second time (FR-005, SC-003)", async () => {
    const root = gitProject(["003-foo"]);
    await wt(root, ["003-foo"]);
    const r = await wt(root, ["003-foo"], { json: true });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ action: "exists" });
    expect(worktreeList(root)).toHaveLength(2);
  });

  it("refuses unknown features and lists valid ones (FR-004)", async () => {
    const root = gitProject(["003-foo", "004-bar"]);
    const r = await wt(root, ["009-nope"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("003-foo, 004-bar");
  });

  it("--dry-run prints the plan and changes nothing (FR-008)", async () => {
    const root = gitProject(["003-foo"]);
    const r = await wt(root, ["003-foo"], { "dry-run": true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("git worktree add -b 003-foo");
    expect(existsSync(join(root, ".worktrees"))).toBe(false);
    expect(existsSync(join(root, ".gitignore"))).toBe(false);
    expect(branchExists(root, "003-foo")).toBe(false);
  });

  it("fails clearly outside a git repository (FR-009)", async () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-nogit-"));
    writeFileSync(join(root, ".gitignore"), "");
    // minimal project without git
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(root, ".amby"));
    mkdirSync(join(root, "specs", "003-foo"), { recursive: true });
    const r = await wt(root, ["003-foo"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Not a git repository");
  });

  it("lists worktrees with branch, state, and path (FR-006)", async () => {
    const root = gitProject(["003-foo", "004-bar"]);
    await wt(root, ["003-foo"]);
    await wt(root, ["004-bar"]);
    writeFileSync(join(root, ".worktrees", "004-bar", "scratch.txt"), "x");
    const r = await wt(root, ["list"], { json: true });
    const rows = JSON.parse(r.out) as { feature: string; branch: string; dirty: boolean; stale: boolean }[];
    expect(rows.map((x) => [x.feature, x.branch, x.dirty, x.stale])).toEqual([
      ["003-foo", "003-foo", false, true], // no commits yet → branch == main tip → "merged"
      ["004-bar", "004-bar", true, true],
    ]);
    const text = await wt(root, ["list"]);
    expect(text.out).toContain("003-foo");
    expect(text.out).toContain("dirty");
  });

  it("removes a clean worktree, keeps the branch, and refuses a dirty one without --force (FR-007)", async () => {
    const root = gitProject(["003-foo", "004-bar"]);
    await wt(root, ["003-foo"]);
    await wt(root, ["004-bar"]);
    writeFileSync(join(root, ".worktrees", "004-bar", "scratch.txt"), "x");

    const clean = await wt(root, ["remove", "003-foo"]);
    expect(clean.code).toBe(0);
    expect(existsSync(join(root, ".worktrees", "003-foo"))).toBe(false);
    expect(branchExists(root, "003-foo")).toBe(true);

    const dirty = await wt(root, ["remove", "004-bar"]);
    expect(dirty.code).toBe(1);
    expect(dirty.err).toContain("--force");
    expect(existsSync(join(root, ".worktrees", "004-bar"))).toBe(true);

    const forced = await wt(root, ["remove", "004-bar"], { force: true });
    expect(forced.code).toBe(0);
    expect(existsSync(join(root, ".worktrees", "004-bar"))).toBe(false);
  });

  it("removing a nonexistent worktree exits 0 (FR-007, SC-003)", async () => {
    const root = gitProject(["003-foo"]);
    const r = await wt(root, ["remove", "003-foo"], { json: true });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ action: "absent", feature: "003-foo" });
  });
});

describe.skipIf(!HAS_GIT)("worktree integrations (feature 012)", () => {
  it("init on a non-TTY / --yes keeps worktree isolation disabled without prompting (FR-011a)", async () => {
    const { InitCommand } = await import("../../src/cli/init.js");
    const target = mkdtempSync(join(tmpdir(), "ambykit-init-wt-"));
    const oLog = console.log;
    console.log = () => {};
    try {
      const code = await new InitCommand().run({ cwd: target, positionals: [target], flags: { yes: true, tools: "claude" } });
      expect(code).toBe(0);
    } finally {
      console.log = oLog;
    }
    const config = JSON.parse(readFileSync(join(target, ".amby", "config.json"), "utf8"));
    expect(config.worktrees).toBeUndefined();
  });

  it("check reports worktrees whose branch is merged into the default branch (FR-013)", async () => {
    const { staleWorktrees } = await import("../../src/cli/check.js");
    const root = gitProject(["003-foo", "004-bar"]);
    await wt(root, ["003-foo"]);
    await wt(root, ["004-bar"]);
    // 004-bar gets a commit that main does not have → not merged; 003-foo stays at main's tip → merged.
    writeFileSync(join(root, ".worktrees", "004-bar", "new.txt"), "x");
    gitRun(join(root, ".worktrees", "004-bar"), ["add", "-A"]);
    gitRun(join(root, ".worktrees", "004-bar"), ["commit", "-q", "-m", "work"]);
    expect(staleWorktrees(root)).toEqual(["003-foo"]);
  });
});

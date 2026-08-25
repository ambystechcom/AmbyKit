import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorktreeList, type GitWorktree } from "../../src/core/git.js";
import { findProjectRoot } from "../../src/core/paths.js";
import {
  ensureGitignore,
  featureFromWorktreePath,
  featureIds,
  featureWorktrees,
  planCreate,
  planRemove,
  worktreePath,
} from "../../src/core/worktree.js";
import { gitProject } from "../helpers/git-repo.js";

const root = "/proj";
const wt = (feature: string, branch: string | null = feature): GitWorktree => ({
  path: `/proj/.worktrees/${feature}`,
  branch,
  head: "abc",
});
const main: GitWorktree = { path: "/proj", branch: "main", head: "abc" };

describe("git porcelain parsing (feature 012)", () => {
  it("parses worktree list --porcelain including detached entries", () => {
    const text = [
      "worktree /proj",
      "HEAD 111",
      "branch refs/heads/main",
      "",
      "worktree /proj/.worktrees/003-foo",
      "HEAD 222",
      "branch refs/heads/003-foo",
      "",
      "worktree /proj/.worktrees/x",
      "HEAD 333",
      "detached",
      "",
    ].join("\n");
    expect(parseWorktreeList(text)).toEqual([
      { path: "/proj", branch: "main", head: "111" },
      { path: "/proj/.worktrees/003-foo", branch: "003-foo", head: "222" },
      { path: "/proj/.worktrees/x", branch: null, head: "333" },
    ]);
  });
});

describe("worktree pure logic (feature 012)", () => {
  it("derives the path under .worktrees/<id> (FR-002)", () => {
    expect(worktreePath(root, "003-foo")).toBe(join(root, ".worktrees", "003-foo"));
  });

  it("adds the ignore rule once (FR-002)", () => {
    const a = ensureGitignore("node_modules/\n");
    expect(a.changed).toBe(true);
    expect(a.text).toContain(".worktrees/");
    expect(ensureGitignore(a.text).changed).toBe(false);
    expect(ensureGitignore("/.worktrees\n").changed).toBe(false);
    expect(ensureGitignore("").text).toMatch(/^# AmbyKit/);
  });

  it("refuses unknown features and lists valid ones (FR-004)", () => {
    const p = planCreate({ root, featureId: "009-nope", features: ["003-foo"], worktrees: [main], branchExists: false, defaultBranch: "main", dirExists: false });
    expect(p).toMatchObject({ action: "refuse" });
    expect((p as { reason: string }).reason).toContain("003-foo");
  });

  it("is a no-op when the worktree already exists (FR-005)", () => {
    const p = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [main, wt("003-foo")], branchExists: true, defaultBranch: "main", dirExists: true });
    expect(p).toEqual({ action: "exists", path: "/proj/.worktrees/003-foo" });
  });

  it("creates a new branch from the default branch, or reuses an existing one (FR-003)", () => {
    const fresh = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [main], branchExists: false, defaultBranch: "main", dirExists: false });
    expect(fresh).toMatchObject({ action: "create", newBranch: true, base: "main", branch: "003-foo" });
    const reuse = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [main], branchExists: true, defaultBranch: "main", dirExists: false });
    expect(reuse).toMatchObject({ action: "create", newBranch: false, base: null });
  });

  it("refuses when the branch is checked out elsewhere or the dir is unregistered (edge cases)", () => {
    const elsewhere = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [{ ...main, branch: "003-foo" }], branchExists: true, defaultBranch: "main", dirExists: false });
    expect(elsewhere).toMatchObject({ action: "refuse" });
    expect((elsewhere as { reason: string }).reason).toContain("/proj");
    const leftover = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [main], branchExists: false, defaultBranch: "main", dirExists: true });
    expect(leftover).toMatchObject({ action: "refuse" });
    expect((leftover as { reason: string }).reason).toContain("prune");
  });

  it("refuses when no default branch can be found (FR-003)", () => {
    const p = planCreate({ root, featureId: "003-foo", features: ["003-foo"], worktrees: [main], branchExists: false, defaultBranch: null, dirExists: false });
    expect(p).toMatchObject({ action: "refuse" });
  });

  it("plans removal: absent → absent; dirty needs --force; never touches the branch (FR-007)", () => {
    expect(planRemove({ root, featureId: "003-foo", worktrees: [main], dirty: false, force: false })).toEqual({ action: "absent" });
    expect(planRemove({ root, featureId: "003-foo", worktrees: [main, wt("003-foo")], dirty: true, force: false })).toMatchObject({ action: "refuse" });
    expect(planRemove({ root, featureId: "003-foo", worktrees: [main, wt("003-foo")], dirty: true, force: true })).toEqual({ action: "remove", path: "/proj/.worktrees/003-foo", force: true });
    expect(planRemove({ root, featureId: "003-foo", worktrees: [main, wt("003-foo")], dirty: false, force: false })).toMatchObject({ action: "remove", force: false });
  });

  it("maps registered worktrees under .worktrees/ to feature ids (FR-006)", () => {
    const rows = featureWorktrees(root, [main, wt("003-foo"), { path: "/elsewhere/x", branch: "x", head: "1" }]);
    expect(rows.map((r) => r.feature)).toEqual(["003-foo"]);
  });

  it("recognizes a feature id from a path inside .worktrees/<id> (FR-010)", () => {
    expect(featureFromWorktreePath(join(root, ".worktrees", "003-foo", "src", "x"))).toBe("003-foo");
    expect(featureFromWorktreePath(join(root, "src"))).toBeNull();
    expect(featureFromWorktreePath(join(root, ".worktrees", "not-an-id"))).toBeNull();
  });
});

describe("project-root discovery inside a worktree (FR-010 edge case)", () => {
  it("lists feature ids from specs/ and resolves the worktree's own .amby first", () => {
    const proj = gitProject(["003-foo", "004-bar"]);
    expect(featureIds(proj)).toEqual(["003-foo", "004-bar"]);
    // Simulate a checked-out worktree: it carries its own .amby/ because the dir is tracked.
    const wtRoot = join(proj, ".worktrees", "003-foo");
    mkdirSync(join(wtRoot, ".amby"), { recursive: true });
    mkdirSync(join(wtRoot, "src", "deep"), { recursive: true });
    expect(findProjectRoot(join(wtRoot, "src", "deep"))).toBe(wtRoot);
  });
});

describe("samePath canonicalization (CI regression: symlinked / 8.3 tmp dirs)", () => {
  it("matches a path against its realpath and a planned child of a real parent", async () => {
    const { realpathSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { samePath } = await import("../../src/core/worktree.js");
    const dir = mkdtempSync(join(tmpdir(), "ambykit-canon-"));
    const real = realpathSync.native(dir);
    expect(samePath(dir, real)).toBe(true);
    expect(samePath(join(dir, "missing-child"), join(real, "missing-child"))).toBe(true);
    expect(samePath(join(dir, "a"), join(dir, "b"))).toBe(false);
  });
});

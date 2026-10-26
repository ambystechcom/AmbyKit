import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCheckouts, primaryRoot, readProjectFeatures, resolveCheckouts } from "../../src/core/checkouts.js";
import type { Checkout, FeatureSnapshot } from "../../src/core/overview-types.js";
import { HAS_GIT, gitRun } from "../helpers/git-repo.js";
import { addWorktree, tick, worktreeProject, writeFeature } from "../helpers/worktree-fixture.js";

function snap(dir: string, done = 0): FeatureSnapshot {
  const ref = dir.slice(0, 3);
  return {
    dir,
    ref,
    displayRef: ref,
    stories: [],
    tasks: Array.from({ length: 10 }, (_, i) => ({ id: `T${i}`, done: i < done, story: null, description: "" })),
    artifacts: { spec: true, ui: false, uiSignedOff: false, plan: false, tasks: true },
    clarifications: [],
  };
}

const wtCheckout = (id: string): Checkout => ({ root: `/r/.worktrees/${id}`, kind: "worktree", branch: id, dirty: false, stale: false });

describe("mergeCheckouts (feature 017, FR-002/003/004)", () => {
  it("a worktree's own dir replaces the primary copy and carries its checkout", () => {
    const out = mergeCheckouts([snap("001-a"), snap("002-b")], [
      { feature: "002-b", checkout: wtCheckout("002-b"), features: [snap("002-b", 5)] },
    ]);
    expect(out.map((f) => f.dir)).toEqual(["001-a", "002-b"]);
    expect(out[1]!.tasks!.filter((t) => t.done)).toHaveLength(5);
    expect(out[1]!.checkout).toEqual(wtCheckout("002-b"));
    expect(out[0]!.checkout).toBeUndefined();
  });

  it("ignores copies of other features found in a worktree (FR-003)", () => {
    const out = mergeCheckouts([snap("001-a")], [
      { feature: "002-b", checkout: wtCheckout("002-b"), features: [snap("001-a", 9), snap("002-b", 1)] },
    ]);
    expect(out.find((f) => f.dir === "001-a")!.tasks!.filter((t) => t.done)).toHaveLength(0);
  });

  it("adds worktree-only features in number order (FR-004)", () => {
    const out = mergeCheckouts([snap("001-a"), snap("005-e")], [
      { feature: "003-c", checkout: wtCheckout("003-c"), features: [snap("003-c")] },
    ]);
    expect(out.map((f) => f.dir)).toEqual(["001-a", "003-c", "005-e"]);
  });

  it("keeps display refs unique when numbers collide", () => {
    const out = mergeCheckouts([snap("003-x")], [{ feature: "003-y", checkout: wtCheckout("003-y"), features: [snap("003-y")] }]);
    expect(out.map((f) => f.displayRef)).toEqual(["003-x", "003-y"]);
  });
});

describe("primaryRoot", () => {
  it("climbs out of .worktrees/<id>", () => {
    expect(primaryRoot(resolve("/r/.worktrees/017-x"))).toBe(resolve("/r"));
    expect(primaryRoot(resolve("/r/.worktrees/017-x/specs"))).toBe(resolve("/r"));
    expect(primaryRoot(resolve("/r"))).toBe(resolve("/r"));
  });
});

describe.skipIf(!HAS_GIT)("readProjectFeatures with real worktrees (US-1)", () => {
  it("shows worktree progress from main and from inside the worktree identically (SC-001)", () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    tick(join(root, ".worktrees", "002-b"), "002-b", 5);
    const fromMain = readProjectFeatures(root);
    const fromWt = readProjectFeatures(join(root, ".worktrees", "002-b"));
    const counts = (r: typeof fromMain) => r.features.map((f) => [f.dir, f.tasks!.filter((t) => t.done).length, f.checkout?.kind ?? "main"]);
    expect(counts(fromMain)).toEqual([["001-a", 0, "main"], ["002-b", 5, "worktree"]]);
    expect(counts(fromWt)).toEqual(counts(fromMain));
    expect(fromMain.issues).toEqual([]);
  });

  it("marks dirty worktrees, and fresh branches are not stale (FR-005)", () => {
    const root = worktreeProject(["001-a"], ["001-a"]);
    let wt = resolveCheckouts(root).worktrees[0]!.checkout;
    expect(wt).toMatchObject({ kind: "worktree", branch: "001-a", dirty: false, stale: false });
    tick(join(root, ".worktrees", "001-a"), "001-a", 2);
    wt = resolveCheckouts(root).worktrees[0]!.checkout;
    expect(wt.dirty).toBe(true);
  });

  it("marks a worktree stale once its branch is merged and main moved on (FR-005)", () => {
    const root = worktreeProject(["001-a"], ["001-a"]);
    const path = join(root, ".worktrees", "001-a");
    tick(path, "001-a", 3);
    gitRun(path, ["commit", "-qam", "work"]);
    gitRun(root, ["merge", "-q", "--no-ff", "-m", "merge", "001-a"]);
    expect(resolveCheckouts(root).worktrees[0]!.checkout.stale).toBe(true);
  });

  it("includes a feature that only exists in its worktree (FR-004)", () => {
    const root = worktreeProject(["001-a"]);
    const path = addWorktree(root, "002-new");
    writeFeature(path, "002-new", 4, 1);
    const r = readProjectFeatures(root);
    expect(r.features.map((f) => f.dir)).toEqual(["001-a", "002-new"]);
  });

  it("reports a missing worktree directory as a parse issue and renders the rest (FR-009)", () => {
    const root = worktreeProject(["001-a", "002-b"], ["002-b"]);
    rmSync(join(root, ".worktrees", "002-b"), { recursive: true, force: true });
    const r = readProjectFeatures(root);
    expect(r.features.map((f) => f.dir)).toEqual(["001-a", "002-b"]);
    expect(r.issues).toEqual([{ file: ".worktrees/002-b", reason: "worktree directory is missing" }]);
  });

  it("no worktrees ⇒ primary only, no checkout fields (FR-008)", () => {
    const root = worktreeProject(["001-a"]);
    const r = readProjectFeatures(root);
    expect(r.checkouts.worktrees).toEqual([]);
    expect(r.features[0]!.checkout).toBeUndefined();
  });
});

describe("readProjectFeatures outside git (FR-008)", () => {
  it("reads the primary checkout only", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-nogit-"));
    writeFeature(root, "001-a", 3);
    const r = readProjectFeatures(root);
    expect(r.checkouts.worktrees).toEqual([]);
    expect(r.features.map((f) => f.dir)).toEqual(["001-a"]);
  });
});

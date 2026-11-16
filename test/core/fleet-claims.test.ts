import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimFiles, claimsPath, readClaims, releaseClaims, releaseTaskClaims } from "../../src/core/fleet/claims.js";
import { createRun, updateRun } from "../../src/core/fleet/runs.js";

const setup = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-claims-"));
  mkdirSync(join(r, ".amby"));
  const out = createRun(r, "a-one");
  if (!out.ok) throw new Error(out.warning);
  return { root: r, run: out.run.run };
};
const NOW = new Date("2026-11-16T10:00:00.000Z");

describe("claims", () => {
  it("025:FR-015: claims files under normalized paths, as { worker, task, at }", () => {
    const { root, run } = setup();
    const out = claimFiles(root, run, { task: "T001", files: ["./Src\\A.ts", "src/b.ts"], worker: "lane-1-1", now: NOW });
    expect(out).toEqual({ ok: true, claimed: ["src/a.ts", "src/b.ts"] });
    expect(readClaims(root, run)).toEqual({
      "src/a.ts": { worker: "lane-1-1", task: "T001", at: NOW.toISOString() },
      "src/b.ts": { worker: "lane-1-1", task: "T001", at: NOW.toISOString() },
    });
    expect(JSON.parse(readFileSync(claimsPath(root, run), "utf8"))).toHaveProperty(["src/a.ts", "worker"], "lane-1-1");
  });

  it("025:FR-015: refuses a claim on an already-claimed file, naming the owner and their task", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["src/a.ts"], worker: "lane-1-1" });
    const out = claimFiles(root, run, { task: "T002", files: ["src/a.ts"], worker: "lane-1-2" });
    expect(out).toEqual({ ok: false, refused: { file: "src/a.ts", owner: "lane-1-1", task: "T001" } });
    expect(readClaims(root, run)["src/a.ts"]?.worker).toBe("lane-1-1");
  });

  it("025:FR-015: overlap-aware: a directory conflicts with a file under it, both ways", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["src/core"], worker: "lane-1-1" });
    const under = claimFiles(root, run, { task: "T002", files: ["src/core/x.ts"], worker: "lane-1-2" });
    expect(under).toMatchObject({ ok: false, refused: { owner: "lane-1-1", task: "T001" } });
    expect(under.ok === false && "refused" in under && under.refused.file).toMatch(/src\/core\/x\.ts.*overlaps src\/core/);
    const { root: r2, run: run2 } = setup();
    claimFiles(r2, run2, { task: "T001", files: ["src/core/x.ts"], worker: "lane-1-1" });
    expect(claimFiles(r2, run2, { task: "T002", files: ["src/core"], worker: "lane-1-2" })).toMatchObject({ ok: false });
    expect(claimFiles(r2, run2, { task: "T002", files: ["src/corex"], worker: "lane-1-2" })).toMatchObject({ ok: true }); // a sibling, not a child
  });

  it("025:FR-015: all or nothing: one refused file means none of the batch is claimed", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["src/b.ts"], worker: "lane-1-1" });
    const out = claimFiles(root, run, { task: "T002", files: ["src/a.ts", "src/b.ts"], worker: "lane-1-2" });
    expect(out).toMatchObject({ ok: false });
    expect(Object.keys(readClaims(root, run))).toEqual(["src/b.ts"]);
  });

  it("025:FR-015: the same worker may claim again (idempotent) and hold overlapping paths", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["src/a.ts"], worker: "lane-1-1" });
    expect(claimFiles(root, run, { task: "T001", files: ["src/a.ts"], worker: "lane-1-1" })).toMatchObject({ ok: true });
    expect(claimFiles(root, run, { task: "T002", files: ["src"], worker: "lane-1-1" })).toMatchObject({ ok: true });
  });

  it("025:FR-015: releasing a task frees all of its claims together and nobody else's", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["src/a.ts", "src/b.ts"], worker: "lane-1-1" });
    claimFiles(root, run, { task: "T002", files: ["src/c.ts"], worker: "lane-1-2" });
    expect(releaseClaims(root, run, "T001")).toEqual(["src/a.ts", "src/b.ts"]);
    expect(Object.keys(readClaims(root, run))).toEqual(["src/c.ts"]);
    expect(claimFiles(root, run, { task: "T003", files: ["src/a.ts"], worker: "lane-1-3" })).toMatchObject({ ok: true });
  });

  it("025:FR-015: releaseTaskClaims frees a task's claims in every unfinished run of the feature, never a finished one", () => {
    const { root, run } = setup();
    const second = createRun(root, "a-one");
    if (!second.ok) throw new Error(second.warning);
    updateRun(root, run, { status: "done" });
    claimFiles(root, run, { task: "T001", files: ["src/a.ts"], worker: "w" });
    claimFiles(root, second.run.run, { task: "T001", files: ["src/b.ts"], worker: "w" });
    expect(releaseTaskClaims(root, "a-one", "T001")).toEqual(["src/b.ts"]);
    expect(Object.keys(readClaims(root, run))).toEqual(["src/a.ts"]);
  });

  it("025:FR-015: rejects a malformed task id and an empty file list instead of writing", () => {
    const { root, run } = setup();
    expect(claimFiles(root, run, { task: "12", files: ["a"], worker: "w" })).toMatchObject({ ok: false, error: expect.stringMatching(/T###/) });
    expect(claimFiles(root, run, { task: "T001", files: [], worker: "w" })).toMatchObject({ ok: false });
    expect(readClaims(root, run)).toEqual({});
  });

  it("an unreadable claims.json reads as no claims", () => {
    const { root, run } = setup();
    claimFiles(root, run, { task: "T001", files: ["a"], worker: "w" });
    mkdirSync(join(root, ".amby", "fleet", "x.1"), { recursive: true });
    expect(readClaims(root, "x.1")).toEqual({});
  });
});

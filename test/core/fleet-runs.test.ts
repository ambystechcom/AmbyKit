import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRun, fleetRoot, listRuns, readRun, resolveRun, updateRun } from "../../src/core/fleet/runs.js";

const root = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-runs-"));
  mkdirSync(join(r, ".amby"));
  return r;
};
const created = (r: string, feature: string): string => {
  const out = createRun(r, feature);
  if (!out.ok) throw new Error(out.warning);
  return out.run.run;
};

describe("fleet runs", () => {
  it("025:FR-024: createRun writes run.json as <feature>.<n> with the data-model fields", () => {
    const r = root();
    const out = createRun(r, "025-mcp-server");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.run.run).toBe("025-mcp-server.1");
    expect(out.run).toMatchObject({ status: "active", stage: "working", round: 0, needsDecision: false, gates: [], lanes: [], limit: 3 });
    expect(readRun(r, out.run.run)).toEqual(out.run);
    expect(existsSync(join(fleetRoot(r), ".gitignore"))).toBe(true);
  });

  it("025:FR-024: run numbers count per feature and are never reused, finished runs included", () => {
    const r = root();
    created(r, "a-one");
    const second = created(r, "a-one");
    updateRun(r, second, { status: "done" });
    expect(created(r, "a-one")).toBe("a-one.3");
    expect(created(r, "b-two")).toBe("b-two.1");
  });

  it("025:FR-024: updateRun merges a patch but never changes id, feature or createdAt", () => {
    const r = root();
    const id = created(r, "a-one");
    const before = readRun(r, id)!;
    const out = updateRun(r, id, { phase: 3, round: 1, needsDecision: true, run: "x", feature: "y", createdAt: "z" } as never);
    expect(out).toMatchObject({ ok: true, run: { run: id, feature: "a-one", createdAt: before.createdAt, phase: 3, round: 1, needsDecision: true } });
  });

  it("025:FR-024: updateRun on a missing run is a warning, not a throw", () => {
    expect(updateRun(root(), "a-one.9", { phase: 1 })).toMatchObject({ ok: false });
  });

  it("025:FR-024: resolveRun returns the single unfinished run", () => {
    const r = root();
    const a = created(r, "a-one");
    const b = created(r, "a-one");
    updateRun(r, a, { status: "done" });
    expect(resolveRun(r, "a-one")).toMatchObject({ ok: true, run: { run: b } });
  });

  it("025:FR-024: with several unfinished runs the warning names them", () => {
    const r = root();
    created(r, "a-one");
    created(r, "a-one");
    const out = resolveRun(r, "a-one");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.warning).toMatch(/a-one\.1.*a-one\.2/);
  });

  it("025:FR-024: with no unfinished run it warns and creates nothing (no implicit run)", () => {
    const r = root();
    expect(resolveRun(r, "a-one")).toMatchObject({ ok: false });
    expect(listRuns(r)).toEqual([]);
    expect(existsSync(fleetRoot(r))).toBe(false);
  });

  it("025:FR-024: an explicit run is honored, and a missing one warns", () => {
    const r = root();
    created(r, "a-one");
    expect(resolveRun(r, "a-one", "a-one.1")).toMatchObject({ ok: true });
    expect(resolveRun(r, "a-one", "a-one.7")).toMatchObject({ ok: false });
  });

  it("025:FR-010: a lane worktree finds the primary checkout's run", () => {
    const r = root();
    created(r, "a-one");
    const lane = join(r, ".worktrees", "a-one.lane-1-1");
    mkdirSync(lane, { recursive: true });
    expect(resolveRun(lane, "a-one")).toMatchObject({ ok: true, run: { run: "a-one.1" } });
  });

  it("a corrupt run.json reads as no run", () => {
    const r = root();
    const id = created(r, "a-one");
    writeFileSync(join(fleetRoot(r), id, "run.json"), "{nope");
    expect(readRun(r, id)).toBeNull();
    expect(readFileSync(join(fleetRoot(r), ".gitignore"), "utf8")).toContain("*");
  });
});

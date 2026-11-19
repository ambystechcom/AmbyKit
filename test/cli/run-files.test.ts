import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acquireRunLock,
  appendEvent,
  bootstrapRun,
  guardNewRun,
  listLaneFiles,
  openRun,
  readBudget,
  readEvents,
  readLaneFile,
  readRunLock,
  releaseRunLock,
  writeBudget,
  writeLaneFile,
  writePromptFile,
} from "../../src/cli/run-files.js";
import { readRun, runDir, updateRun } from "../../src/core/fleet/index.js";
import { gitProject } from "../helpers/git-repo.js";

const F = "028-ambykit-run";
const lanes = [{ lane: `${F}.lane-1-1`, assistant: "claude", tasks: ["T001"] }];
const alive = () => true;
const dead = () => false;

describe("run files over spec 025's store (feature 028)", () => {
  it("028:FR-017: bootstrap creates run <feature>.<n> through 025's store with the lanes", () => {
    const root = gitProject([F]);
    const out = bootstrapRun(root, F, lanes, dead);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.run.run).toBe(`${F}.1`);
      expect(readRun(root, out.run.run)?.lanes).toEqual(lanes);
    }
  });

  it("028:FR-017: a second run on the same feature refuses while one is unfinished, pointing at --continue-run", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    const again = bootstrapRun(root, F, lanes, dead);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.warning).toContain(`--continue-run=${F}.1`);
  });

  it("028:FR-017: the refusal names the live process when the run is being supervised", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    acquireRunLock(root, `${F}.1`, 4242, dead);
    const g = guardNewRun(root, F, alive);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reason).toContain("4242");
  });

  it("028:FR-017: once a run is done a new run may start and gets the next number", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    updateRun(root, `${F}.1`, { status: "done" });
    const next = bootstrapRun(root, F, lanes, dead);
    expect(next.ok && next.run.run).toBe(`${F}.2`);
  });

  it("028:FR-017: the run lock is held by one live process; a dead holder's lock is taken over", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    const run = `${F}.1`;
    expect(acquireRunLock(root, run, 100, dead).ok).toBe(true);
    expect(acquireRunLock(root, run, 200, alive).ok).toBe(false);
    expect(acquireRunLock(root, run, 200, dead).ok).toBe(true);
    expect(readRunLock(root, run)?.pid).toBe(200);
    releaseRunLock(root, run, 100);
    expect(readRunLock(root, run)?.pid).toBe(200);
    releaseRunLock(root, run, 200);
    expect(readRunLock(root, run)).toBeNull();
  });

  it("028:FR-017: per-lane files, events, prompts and the budget meter live under the run directory", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    const run = `${F}.1`;
    writeLaneFile(root, run, { lane: "lane-1-1", full: `${F}.lane-1-1`, assistant: "claude", status: "running", restarts: 1, pid: 5 });
    expect(readLaneFile(root, run, "lane-1-1")).toMatchObject({ status: "running", restarts: 1 });
    expect(listLaneFiles(root, run).map((l) => l.lane)).toEqual(["lane-1-1"]);
    appendEvent(root, run, { kind: "started", lane: "lane-1-1" });
    appendEvent(root, run, { kind: "merged", lane: "lane-1-1", detail: "ok" });
    expect(readEvents(root, run).map((e) => e.kind)).toEqual(["started", "merged"]);
    const prompt = writePromptFile(root, run, "lane-1-1", "hello");
    expect(prompt.startsWith(runDir(root, run))).toBe(true);
    expect(readBudget(root, run)).toEqual({ elapsedMs: 0, tasksUsed: 0, counted: [] });
    writeBudget(root, run, { elapsedMs: 5, tasksUsed: 2, counted: ["T001"] });
    expect(readBudget(root, run).tasksUsed).toBe(2);
  });

  it("028:FR-017: a run with missing state is rebuilt from tasks.md through 025", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    rmSync(join(runDir(root, `${F}.1`), "run.json"));
    const opened = openRun(root, `${F}.1`);
    expect(opened.ok && opened.rebuilt).toBe(true);
    expect(readRun(root, `${F}.1`)).not.toBeNull();
  });

  it("028:FR-017: opening a run that never existed is refused by name", () => {
    const root = gitProject([F]);
    const opened = openRun(root, `${F}.7`);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toContain(`${F}.7`);
  });

  it("028:FR-017: an intact run opens as it is", () => {
    const root = gitProject([F]);
    bootstrapRun(root, F, lanes, dead);
    const opened = openRun(root, `${F}.1`);
    expect(opened.ok && opened.rebuilt).toBe(false);
  });
});

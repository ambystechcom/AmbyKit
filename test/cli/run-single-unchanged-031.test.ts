import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEvents } from "../../src/cli/run-files.js";
import { fleetIds, fleetRoot, listFleets, listRuns, runDir, runDirRel } from "../../src/core/fleet/index.js";
import { lanePromptText } from "../../src/cli/run-plan.js";
import { laneRefs } from "../../src/core/query.js";
import { FakePort, preparedProject } from "../helpers/run-fakes.js";
import { fleetRun, scriptWorkers } from "../helpers/fleet-run-fixture.js";

const F = "031-multi-feature-fleets";

/**
 * 031:FR-019 (US-9): a single feature runs exactly as it did before the fleet code existed. The 028 run tests pass
 * unchanged (they are in the same suite); this file pins what a single run looks like from the outside: where its
 * state lives, what it prints and what it records.
 */
describe("a single feature runs as before (feature 031, US-9)", () => {
  it("031:FR-019: state lives in a flat run directory, no fleet directory or record is created", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    const r = await fleetRun(p.root, [F], { yes: true, assistant: "claude" }, { port });
    expect(r.code, r.err).toBe(0);
    expect(runDir(p.root, `${F}.1`)).toBe(join(fleetRoot(p.root), `${F}.1`));
    expect(existsSync(join(fleetRoot(p.root), `${F}.1`, "run.json"))).toBe(true);
    expect(fleetIds(p.root)).toEqual([]);
    expect(listFleets(p.root)).toEqual([]);
    expect(listRuns(p.root).map((x) => [x.run, x.status])).toEqual([[`${F}.1`, "done"]]);
  }, 120_000);

  it("031:FR-019: the single run prints its own plan and finish line, with no fleet wording", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    const r = await fleetRun(p.root, [F], { yes: true, assistant: "claude" }, { port });
    expect(r.out).toContain(`Run plan for ${F} — run ${F}.1 (experimental)`);
    expect(r.out).toContain("Mode: attended");
    expect(r.out).toContain(`Run ${F}.1 is done: every lane merged.`);
    expect(r.out + r.err).not.toMatch(/fleet plan|fleet-\d|--continue-fleet/i);
  }, 120_000);

  it("031:FR-019: the single run records the same event sequence as 028 (start, review rounds, merge, done)", async () => {
    const p = await preparedProject(F, 2, 1);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    await fleetRun(p.root, [F], { yes: true, assistant: "claude" }, { port });
    const kinds = readEvents(p.root, `${F}.1`).map((e) => e.kind);
    expect(kinds[0]).toBe("started");
    expect(kinds).toContain("finished");
    expect(kinds).toContain("merged");
    expect(kinds.at(-1)).toBe("done");
    expect(kinds).not.toContain("budget-exceeded");
  }, 120_000);

  it("031:FR-019: the prompts a single run sends name the flat run directory, exactly as before", async () => {
    const p = await preparedProject(F, 2, 1);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    await fleetRun(p.root, [F], { yes: true, assistant: "claude" }, { port });
    const qa = readFileSync(join(fleetRoot(p.root), `${F}.1`, "prompts", "lane-1-1.qa.1.md"), "utf8");
    expect(qa).toContain(`Write your verdict to .amby/fleet/${F}.1/verdicts/lane-1-1.qa.1.json as JSON`);
    expect(runDirRel(p.root, `${F}.1`)).toBe(`.amby/fleet/${F}.1`);
    const lane = laneRefs(p.root, F)[0]!;
    expect(lanePromptText(lane, `${F}.1`)).toContain(`--run=${F}.1`);
    expect(lanePromptText(lane, `${F}.1`, undefined, ["F-1"])).toContain(`under .amby/fleet/${F}.1/verdicts/`);
  }, 120_000);

  it("031:FR-019: the same feature given twice is the same single run, not a fleet", async () => {
    const p = await preparedProject(F, 2, 1);
    const port = new FakePort();
    scriptWorkers(port, p.root);
    const r = await fleetRun(p.root, [F, "031"], { yes: true, assistant: "claude" }, { port });
    expect(r.code, r.err).toBe(0);
    expect(fleetIds(p.root)).toEqual([]);
    expect(r.out).toContain(`Run plan for ${F}`);
  }, 120_000);

  it("031:FR-019: the single-run preview JSON has the same shape as in 028 (no fleet fields added)", async () => {
    const p = await preparedProject(F, 2, 1);
    const r = await fleetRun(p.root, [F], { json: true, assistant: "claude" });
    const doc = JSON.parse(r.out) as Record<string, unknown>;
    expect(Object.keys(doc).sort()).toEqual(["budgets", "caps", "experimental", "feature", "lanes", "launched", "launching", "run", "unattended"]);
  });

  it("031:FR-019: existing commands print the same without the fleet capability in use", async () => {
    const p = await preparedProject(F, 2, 1);
    const r = await fleetRun(p.root, ["--runners" as never].slice(0, 0), { runners: true });
    expect(r.out).toContain("Headless runners (experimental).");
  });
});

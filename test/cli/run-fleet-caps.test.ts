import { describe, expect, it } from "vitest";
import { FakePort } from "../helpers/run-fakes.js";
import { deferredWorkers, fleetRun, gitFleetProject } from "../helpers/fleet-run-fixture.js";
import { listFleets } from "../../src/core/fleet/index.js";
import { fleetSettings, loadConfig } from "../../src/core/config.js";

const two = (dir: string) => ({
  dir,
  tasks: [
    { id: "T001", paths: [`src/${dir}-1.ts`] },
    { id: "T002", paths: [`src/${dir}-2.ts`] },
  ],
});

async function runFleetWith(assistants: string, config: Record<string, unknown> = {}) {
  const p = gitFleetProject([two("031-a"), two("032-b")]);
  if (Object.keys(config).length > 0) {
    const { writeFileSync, readFileSync } = await import("node:fs");
    const file = `${p.root}/.amby/config.json`;
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), ...config }) + "\n");
  }
  const port = new FakePort();
  const work = deferredWorkers(port, p.root);
  let n = 0;
  const sleep = async (): Promise<void> => {
    n += 1;
    if (n > 600) throw new Error("the fleet did not finish within 600 ticks");
    work.finishNext(); // one worker at a time exits, so the others stay alive and count toward the caps
  };
  const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: assistants }, { port, deps: { sleep } });
  return { p, r, work };
}

describe("the fleet never exceeds its caps (feature 031, US-5)", () => {
  it("031:FR-012: with no cap configured the whole fleet runs at most 3 assistants at once", async () => {
    const { r, work } = await runFleetWith("claude,codex");
    expect(r.code, r.err).toBe(0);
    expect(work.maxLive()).toBe(3); // 4 lanes could run; the fleet cap holds them to 3
  }, 120_000);

  it("031:FR-012: and at most 2 of one assistant type, across both features", async () => {
    const { r, work } = await runFleetWith("claude");
    expect(r.code, r.err).toBe(0);
    expect(work.maxLiveOfType()).toBe(2);
    expect(work.maxLive()).toBe(2); // only one type is in use, so the per-type cap is the binding one
  }, 120_000);

  it("031:FR-010: configured caps apply to the fleet (fleet.concurrency: 2 total)", async () => {
    const { p, r, work } = await runFleetWith("claude,codex", { fleet: { concurrency: { total: 2, perType: 2 } } });
    expect(r.code, r.err).toBe(0);
    expect(work.maxLive()).toBe(2);
    expect(listFleets(p.root)[0]!.caps).toEqual({ total: 2, perType: 2 });
  }, 120_000);

  it("031:FR-012: the default fleet caps are the 028 defaults of 3 and 2, applied to the whole fleet", () => {
    expect(fleetSettings(loadConfig("/nowhere")).concurrency).toEqual({ total: 3, perType: 2 });
  });
});

import { describe, expect, it } from "vitest";
import { controlFleet } from "../../src/cli/run-fleet-control.js";
import { createFleet, createRun, readDirective } from "../../src/core/fleet/index.js";
import { listFleets } from "../../src/core/fleet/index.js";
import type { FleetFeature } from "../../src/core/fleet-plan/types.js";
import { FakePort } from "../helpers/run-fakes.js";
import { writeLaneFile } from "../../src/cli/run-files.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { tempProject } from "../helpers/spec-project.js";

const feat = (feature: string, run?: string): FleetFeature => ({ feature, state: "running", waitsFor: [], ownership: { files: [], unknown: [] }, fingerprint: "f", ...(run ? { run } : {}) });

function recorded(): string {
  const root = tempProject({});
  createFleet(root, { features: [feat("031-a", "031-a.1"), feat("032-b", "032-b.1"), feat("033-c")], caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 10 }, unattended: false });
  createRun(root, "031-a", { fleet: "fleet-1", lanes: [{ lane: "031-a.lane-1-1", assistant: "claude", tasks: ["T001"] }, { lane: "031-a.lane-1-2", assistant: "codex", tasks: ["T002"] }] });
  createRun(root, "032-b", { fleet: "fleet-1", lanes: [{ lane: "032-b.lane-1-1", assistant: "claude", tasks: ["T001"] }] });
  return root;
}

describe("pause, stop and resume a whole fleet (feature 031, US-6)", () => {
  it("031:FR-015: pausing writes one directive for every lane of every feature through the core writer", () => {
    const root = recorded();
    const out = controlFleet(root, "fleet-1", "pause", new Date("2026-01-01T00:00:00Z"));
    expect(out).toEqual({ ok: true, written: ["031-a:lane-1-1", "031-a:lane-1-2", "032-b:lane-1-1"] });
    expect(readDirective(root, "031-a.1", "lane-1-1")).toEqual({ action: "pause", at: "2026-01-01T00:00:00.000Z" });
    expect(readDirective(root, "031-a.1", "lane-1-2")?.action).toBe("pause");
    expect(readDirective(root, "032-b.1", "lane-1-1")?.action).toBe("pause");
  });

  it("031:FR-015: stopping writes stop directives; resuming writes continue (resume is not an action of its own)", () => {
    const root = recorded();
    controlFleet(root, "fleet-1", "stop");
    expect(readDirective(root, "032-b.1", "lane-1-1")?.action).toBe("stop");
    controlFleet(root, "fleet-1", "resume");
    expect(readDirective(root, "032-b.1", "lane-1-1")?.action).toBe("continue");
  });

  it("031:FR-015: a merged lane gets the directive too, so a run between two stages (every lane merged) is held and resumed", () => {
    const root = recorded();
    writeLaneFile(root, "032-b.1", { lane: "lane-1-1", full: "032-b.lane-1-1", assistant: "claude", status: "merged", restarts: 0 });
    expect(controlFleet(root, "fleet-1", "pause").written).toContain("032-b:lane-1-1");
    expect(readDirective(root, "032-b.1", "lane-1-1")?.action).toBe("pause");
    controlFleet(root, "fleet-1", "resume");
    expect(readDirective(root, "032-b.1", "lane-1-1")?.action).toBe("continue");
  });

  it("031:FR-015: an unknown fleet is an error and writes nothing", () => {
    expect(controlFleet(recorded(), "fleet-9", "pause")).toMatchObject({ ok: false, error: "fleet 'fleet-9' not found" });
  });

  it("031:FR-015: ambykit run pause|stop|resume <fleet> is the command for it", async () => {
    const root = recorded();
    const r = await fleetRun(root, ["pause", "fleet-1"], {});
    expect(r.code).toBe(0);
    expect(r.out).toContain("Asked 3 lanes of fleet-1 to pause; each worker obeys at its next report.");
    const json = await fleetRun(root, ["resume", "fleet-1"], { json: true });
    expect(JSON.parse(json.out)).toEqual({ fleet: "fleet-1", action: "resume", lanes: ["031-a:lane-1-1", "031-a:lane-1-2", "032-b:lane-1-1"] });
    expect((await fleetRun(root, ["pause"], {})).code).toBe(1);
    expect((await fleetRun(root, ["pause", "fleet-9"], {})).code).toBe(1);
  });

  it("031:FR-015: over real sessions, a paused fleet's workers finish their turn and every feature pauses", async () => {
    const two = (dir: string) => ({ dir, tasks: [{ id: "T001", paths: [`src/${dir}-1.ts`] }, { id: "T002", paths: [`src/${dir}-2.ts`] }] });
    const p = gitFleetProject([two("031-a"), two("032-b")]);
    const port = new FakePort();
    scriptWorkers(port, p.root, { hold: () => true }); // workers stay alive until told to stop
    let paused = false;
    let n = 0;
    const sleep = async (): Promise<void> => {
      n += 1;
      if (!paused && port.starts.length >= 3) {
        paused = true;
        const out = controlFleet(p.root, "fleet-1", "pause");
        expect(out.written).toHaveLength(4); // every lane of both features, including the one still queued
        for (const h of port.starts) h.finish(0); // the workers obey: they end their turn
      }
      const fleet = listFleets(p.root)[0];
      if (paused && fleet?.features.every((f) => f.state === "paused")) process.emit("SIGINT");
      if (n > 200) process.emit("SIGINT");
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude,codex" }, { port, deps: { sleep } });
    expect(r.code, r.err + r.out).toBe(0);
    const fleet = listFleets(p.root)[0]!;
    expect(fleet.features.map((f) => f.state)).toEqual(["paused", "paused"]);
    expect(port.starts).toHaveLength(3); // nothing new started once paused: the queued lane stayed queued
  }, 120_000);
});

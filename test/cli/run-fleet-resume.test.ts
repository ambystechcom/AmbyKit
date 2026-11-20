import { describe, expect, it } from "vitest";
import { feature, loop, states } from "../helpers/fleet-loop-fixture.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { listFleets } from "../../src/core/fleet/index.js";
import { controlFleet } from "../../src/cli/run-fleet-control.js";

const dep = (on: string) => [{ feature: on, why: "depends-on" as const }];

describe("resuming a paused feature releases its dependents (feature 031, US-4)", () => {
  it("031:FR-009: once nothing waits for a person the feature runs again and its dependents are released", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    await h.sup.tick();
    const a = h.fakes.get("031-a")!;
    a.person = "lane-1-1 paused";
    await h.sup.tick();
    expect(h.rec.features[1]!.heldBy).toBe("031-a");
    a.person = null; // a person resumed the lane
    await h.sup.tick();
    expect(states(h)["031-a"]).toBe("running");
    expect(h.rec.features[1]!.heldBy).toBeUndefined();
    expect(h.said.some((l) => l.includes("032-b: released"))).toBe(true);
    a.finish();
    await h.sup.tick();
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a", "032-b"]);
  });

  it("031:FR-009: a dependent that was held starts only after what holds it is done, not merely resumed", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    await h.sup.tick();
    const a = h.fakes.get("031-a")!;
    a.person = "paused";
    await h.sup.tick();
    a.person = null;
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a"]);
  });

  it("031:FR-009: a feature that could not start is retried each tick, so a conflict resolved by hand lets it start", async () => {
    const fail: Record<string, string> = { "031-a": "merging 030-x into 031-a conflicts in src/x.ts" };
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))], { fail });
    await h.sup.tick();
    expect(states(h)).toEqual({ "031-a": "paused", "032-b": "waiting" });
    await h.sup.tick();
    expect(h.begun).toEqual([]); // still conflicting: nothing starts, nothing is announced twice
    expect(h.said.filter((l) => l.includes("not started")).length).toBe(1);
    delete fail["031-a"]; // resolved by hand
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a"]);
    expect(states(h)["031-a"]).toBe("running");
  });

  it("031:FR-009: resuming the fleet with a stalled lane paused: its directive lets the feature finish, then B starts (real sessions)", async () => {
    const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }] };
    const B = { dir: "032-b", dependsOn: ["031"], tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };
    const p = gitFleetProject([A, B]);
    const port = new FakePort();
    let holdA = true;
    scriptWorkers(port, p.root, { hold: (f) => f === "031-a" && holdA });
    let clock = Date.now();
    let resumed = false;
    let ticks = 0;
    const sleep = async (): Promise<void> => {
      clock += 6 * 60_000;
      ticks += 1;
      if (ticks > 300) process.emit("SIGINT");
      const fleet = listFleets(p.root)[0];
      if (!resumed && fleet?.features.find((f) => f.feature === "031-a")?.state === "paused") {
        resumed = true;
        holdA = false; // the cause is fixed
        const out = controlFleet(p.root, "fleet-1", "resume", new Date(clock));
        expect(out.ok).toBe(true);
        expect(out.written).toEqual(["031-a:lane-1-1"]);
      }
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep, now: () => clock } });
    expect(r.code, r.err + r.out).toBe(0);
    expect(resumed).toBe(true);
    const fleet = listFleets(p.root)[0]!;
    expect(fleet.status).toBe("done");
    expect(fleet.features.map((f) => f.state)).toEqual(["done", "done"]);
  }, 120_000);
});

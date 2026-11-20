import { describe, expect, it } from "vitest";
import { feature, loop, states } from "../helpers/fleet-loop-fixture.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { listFleets } from "../../src/core/fleet/index.js";

const dep = (on: string) => [{ feature: on, why: "depends-on" as const }];

describe("a failing lane pauses only its feature and what depends on it (feature 031, US-4)", () => {
  it("031:FR-009: the paused feature holds its dependents, directly and through a chain, while an independent one finishes", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a")), feature("033-c"), feature("034-d", dep("032-b"))]);
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a", "033-c"]);
    h.fakes.get("031-a")!.person = "lane-1-1 paused (stalled again after 2 restarts; a person must decide)";
    await h.sup.tick();
    expect(states(h)).toEqual({ "031-a": "paused", "032-b": "waiting", "033-c": "running", "034-d": "waiting" });
    expect(h.rec.features.find((f) => f.feature === "032-b")!.heldBy).toBe("031-a");
    expect(h.rec.features.find((f) => f.feature === "034-d")!.heldBy).toBe("031-a");
    h.fakes.get("033-c")!.finish();
    await h.sup.tick();
    expect(states(h)["033-c"]).toBe("done"); // the independent feature finished
    expect(h.begun).not.toContain("032-b"); // and nothing held started
    expect(h.rec.status).toBe("waiting-person");
  });

  it("031:FR-009: the pause records its cause on the feature", async () => {
    const h = loop([feature("031-a")]);
    await h.sup.tick();
    h.fakes.get("031-a")!.person = "lane-1-2 conflict (merge conflict)";
    await h.sup.tick();
    expect(h.rec.features[0]).toMatchObject({ state: "paused", cause: "lane-1-2 conflict (merge conflict)" });
  });

  it("031:FR-009: a feature whose supervisor reports a person is needed (stays, rejected, attention) is paused too", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    await h.sup.tick();
    h.fakes.get("031-a")!.outcome = { kind: "rejected", message: "Checkpoint story-1 was rejected." };
    await h.sup.tick();
    expect(states(h)).toEqual({ "031-a": "paused", "032-b": "waiting" });
    expect(h.rec.features[0]!.cause).toContain("rejected");
  });

  it("031:FR-013: a feature that cannot start (a merge conflict before it starts) pauses only that feature and its dependents", async () => {
    const h = loop([feature("031-a"), feature("032-b"), feature("033-c", dep("032-b"))], { fail: { "032-b": "merging 031-a into 032-b conflicts in src/x.ts" } });
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a"]);
    expect(states(h)).toEqual({ "031-a": "running", "032-b": "paused", "033-c": "waiting" });
    expect(h.rec.features[1]!.cause).toContain("conflicts in src/x.ts");
    await h.sup.tick();
    expect(h.rec.features[2]!.heldBy).toBe("032-b");
  });

  it("031:FR-009: a stalled lane that exhausts its restarts pauses its feature; the independent feature finishes (real sessions)", async () => {
    const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }] };
    const B = { dir: "032-b", dependsOn: ["031"], tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };
    const C = { dir: "033-c", tasks: [{ id: "T001", paths: ["src/c1.ts"] }] };
    const p = gitFleetProject([A, B, C]);
    const port = new FakePort();
    scriptWorkers(port, p.root, { hold: (f) => f === "031-a" }); // A's worker never finishes
    let clock = Date.now();
    let ticks = 0;
    const sleep = async (): Promise<void> => {
      clock += 6 * 60_000; // six fake minutes per tick: 15 minutes without a report is a stall
      ticks += 1;
      const fleet = listFleets(p.root)[0];
      const c = fleet?.features.find((f) => f.feature === "033-c")?.state;
      const a = fleet?.features.find((f) => f.feature === "031-a")?.state;
      if ((c === "done" && a === "paused") || ticks > 200) process.emit("SIGINT");
    };
    const r = await fleetRun(p.root, ["031", "032", "033"], { yes: true, assistant: "claude" }, { port, deps: { sleep, now: () => clock } });
    expect(r.code, r.err + r.out).toBe(0); // interrupted by the test once the state was reached
    const fleet = listFleets(p.root)[0]!;
    const st = Object.fromEntries(fleet.features.map((f) => [f.feature, f.state]));
    expect(st["033-c"]).toBe("done");
    expect(st["031-a"]).toBe("paused");
    expect(st["032-b"]).toBe("waiting");
    expect(fleet.features.find((f) => f.feature === "031-a")!.cause).toContain("stalled again after 2 restarts");
    expect(fleet.features.find((f) => f.feature === "032-b")!.heldBy).toBe("031-a");
  }, 120_000);
});

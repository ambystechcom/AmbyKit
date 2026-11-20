import { describe, expect, it } from "vitest";
import { LaneCommand } from "../../src/cli/lane.js";
import { approveGate } from "../../src/core/run-gate-actions.js";
import { listFleets, readRun } from "../../src/core/fleet/index.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { runCommand } from "../helpers/run-command.js";

const states = (root: string): Record<string, string> => Object.fromEntries(listFleets(root)[0]!.features.map((f) => [f.feature, f.state]));

describe("approval gates and merges are per feature inside a fleet (feature 031, US-6)", () => {
  it("031:FR-013: a feature waiting at a story checkpoint waits alone; the other feature finishes, then approval lets it go on", async () => {
    const A = {
      dir: "031-a",
      phases: [
        [{ id: "T001", paths: ["src/a1.ts"], story: 1 }],
        [{ id: "T002", paths: ["src/a2.ts"], story: 2 }],
      ],
    };
    const B = { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };
    const p = gitFleetProject([A, B]);
    await runCommand(new LaneCommand(), p.root, ["031-a"], { phase: "1", lanes: "1" });
    await runCommand(new LaneCommand(), p.root, ["031-a"], { phase: "2", lanes: "1" });
    const port = new FakePort();
    scriptWorkers(port, p.root);
    let n = 0;
    let gateSeen = false;
    let bDoneWhileWaiting = false;
    const sleep = async (): Promise<void> => {
      n += 1;
      if (n > 400) throw new Error("the fleet did not finish within 400 ticks");
      const rec = readRun(p.root, "031-a.1");
      const gate = rec?.gates.find((g) => g.id === "phase-1");
      if (gate?.state === "pending" && !gateSeen) {
        gateSeen = true;
      }
      if (gate?.state === "pending" && states(p.root)["032-b"] === "done") {
        bDoneWhileWaiting = true;
        approveGate(p.root, "031-a.1", { by: "person" });
      }
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
    expect(r.code, r.err + r.out).toBe(0);
    expect(gateSeen).toBe(true);
    expect(bDoneWhileWaiting).toBe(true); // B finished while A's checkpoint was still pending
    expect(readRun(p.root, "031-a.1")!.gates).toEqual([{ id: "phase-1", after: "US-1", state: "approved" }]);
    expect(states(p.root)).toEqual({ "031-a": "done", "032-b": "done" });
  }, 120_000);

  it("031:FR-013: a real merge conflict pauses only that feature and waits for a person; the other feature finishes", async () => {
    const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }, { id: "T002", paths: ["src/a2.ts"] }] };
    const B = { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };
    const p = gitFleetProject([A, B]);
    const port = new FakePort();
    scriptWorkers(port, p.root, { clash: (f) => (f === "031-a" ? "src/clash.ts" : undefined) });
    let n = 0;
    const sleep = async (): Promise<void> => {
      n += 1;
      const s = states(p.root);
      if ((s["031-a"] === "paused" && s["032-b"] === "done") || n > 200) process.emit("SIGINT");
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
    expect(r.code, r.err + r.out).toBe(0); // ended by the test's interrupt once the state was reached
    const fleet = listFleets(p.root)[0]!;
    const a = fleet.features.find((f) => f.feature === "031-a")!;
    expect(a.state).toBe("paused");
    expect(a.cause).toContain("conflict");
    expect(fleet.features.find((f) => f.feature === "032-b")!.state).toBe("done");
  }, 120_000);
});

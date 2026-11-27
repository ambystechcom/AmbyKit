import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listFleets } from "../../src/core/fleet/index.js";
import { featureBranch } from "../../src/core/lane-merge.js";
import { FakePort } from "../helpers/run-fakes.js";
import { fleetRun, gitFleetProject, scriptWorkers } from "../helpers/fleet-run-fixture.js";
import { gitRun } from "../helpers/git-repo.js";

/**
 * Fleet behaviour the 2.0 dogfood (`ambykit run 037 038 --assistant=claude`) found wanting: a feature without a worktree
 * paused asking a person to run `ambykit worktree`, and `--continue-fleet` launched without `--yes`.
 */

const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a1.ts"] }] };
const B = { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b1.ts"] }] };

describe("fleet: worktrees and --continue-fleet (the 2.0 dogfood)", () => {
  it("031:FR-013: a feature with no worktree gets one when it starts, instead of pausing for a person", async () => {
    const p = gitFleetProject([A, B]);
    gitRun(p.root, ["worktree", "remove", "--force", p.roots["032-b"]!]);
    expect(featureBranch(p.root, "032-b")?.checkout ?? null).toBeNull();
    const port = new FakePort();
    scriptWorkers(port, p.root);
    let n = 0;
    const sleep = async (): Promise<void> => {
      if (++n > 300) throw new Error("the fleet did not finish within 300 ticks");
    };
    const r = await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
    expect(r.code, r.err + r.out).toBe(0);
    expect(r.out).toContain("[032-b] created its worktree");
    expect(featureBranch(p.root, "032-b")?.checkout).toBeTruthy();
    expect(listFleets(p.root)[0]!.features.map((f) => f.state)).toEqual(["done", "done"]);
  }, 120_000);

  it("028:FR-001: --continue-fleet previews and launches nothing without --yes", async () => {
    const p = gitFleetProject([A, B]);
    const port = new FakePort();
    scriptWorkers(port, p.root, { hold: () => true }); // the workers never finish: the fleet is stopped mid-way
    let n = 0;
    const sleep = async (): Promise<void> => {
      if (++n > 3) process.emit("SIGINT");
    };
    await fleetRun(p.root, ["031", "032"], { yes: true, assistant: "claude" }, { port, deps: { sleep } });
    const port2 = new FakePort();
    const r = await fleetRun(p.root, [], { assistant: "claude", "continue-fleet": "fleet-1" }, { port: port2 });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Nothing launched. Re-run with --yes to continue this fleet.");
    expect(port2.starts).toHaveLength(0);
    expect(existsSync(p.root)).toBe(true);
  }, 120_000);
});

import { describe, expect, it } from "vitest";
import { readLaneFile } from "../../src/cli/run-files.js";
import { writeDirective } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, script, type Harness } from "../helpers/run-fakes.js";
import { LaneCommand } from "../../src/cli/lane.js";
import { laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd } from "../helpers/tasks-fixture.js";

/**
 * A paused lane or run starts nothing new (the 2.0 dogfood: `ambykit run pause` reached the worker at its next report,
 * but the supervisor still started a QA review of the lane that had just finished, and would have started more).
 * Running processes finish; no worker, review or next stage starts until the lane is resumed.
 */

const F = "028-ambykit-run";
let clock = Date.parse("2026-11-27T10:00:00Z");
const direct = (h: Harness, root: string, action: "pause" | "continue", lane = "lane-1-1"): void => {
  clock += 1000;
  const out = writeDirective(root, { feature: F, lane, action, run: h.run, now: new Date(clock) });
  if (!out.ok) throw new Error(out.error);
};
const reviews = (h: Harness, role?: "qa" | "architect"): string[] =>
  h.port.starts.map((x) => x.spec.stdin ?? "").filter((t) => (role ? new RegExp(`Act as the ${role} reviewer`).test(t) : /reviewer:/.test(t)));
const steps = async (h: Harness, n: number): Promise<unknown> => {
  let out: unknown = null;
  for (let i = 0; i < n && out === null; i++) out = await h.step();
  return out;
};

describe.skipIf(!HAS_GIT)("pause holds new work (the 2.0 dogfood)", () => {
  it("a lane paused while its worker runs: the worker finishes, but no review starts until it is resumed; then QA, the architect and the merge follow", async () => {
    const p = await preparedProject(F, 2, 1);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, (_cwd, prompt) => {
      if (/check each off in tasks\.md/.test(prompt) && reviews(h).length === 0) direct(h, p.root, "pause");
      return { work: true, verdict: "pass" };
    });
    await steps(h, 6);
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("finished");
    expect(reviews(h)).toHaveLength(0);

    direct(h, p.root, "continue");
    const out = await steps(h, 12);
    expect(out).toMatchObject({ kind: "done" });
    expect(reviews(h, "qa")).toHaveLength(1);
    expect(reviews(h, "architect")).toHaveLength(1);
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("merged");
  });

  it("paused while QA runs: QA's verdict is read, but the architect does not start until resume, and QA is not run again", async () => {
    const p = await preparedProject(F, 2, 1);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, (_cwd, prompt) => {
      if (/Act as the qa reviewer/.test(prompt)) direct(h, p.root, "pause");
      return { work: true, verdict: "pass" };
    });
    await steps(h, 8);
    expect(reviews(h, "qa")).toHaveLength(1);
    expect(reviews(h, "architect")).toHaveLength(0);
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).not.toBe("merged");

    direct(h, p.root, "continue");
    expect(await steps(h, 12)).toMatchObject({ kind: "done" });
    expect(reviews(h, "qa")).toHaveLength(1);
    expect(reviews(h, "architect")).toHaveLength(1);
  });

  it("a queued worker of a paused lane does not start; it starts on resume", async () => {
    const p = await preparedProject(F, 2, 1);
    const h = harness(p, { review: false, assistants: ["claude"] });
    script(h, p, { work: true });
    direct(h, p.root, "pause");
    await steps(h, 4);
    expect(h.port.starts).toHaveLength(0);
    direct(h, p.root, "continue");
    expect(await steps(h, 8)).toMatchObject({ kind: "done" });
    expect(h.port.starts).toHaveLength(1);
  });

  it("a run held between two stages (every lane, merged ones included, paused) prepares no next stage until resumed", async () => {
    const G = "037-adr-citation-severity";
    const p = laneProject(G, tasksMd([phase(1, [{ id: "T001", paths: ["src/a.ts"] }]), phase(2, [{ id: "T010", paths: ["src/b.ts"] }])], { feature: G }));
    await runCommand(new LaneCommand(), p.root, [G], { next: true });
    const h = harness(p, { assistants: ["claude"], stages: true, unattended: true });
    let paused = false;
    script(h, p, (_cwd, prompt) => {
      // pause the (only) lane of stage 1 while its worker runs: it finishes and merges, then the run is held
      if (/: T001\./.test(prompt) && !paused) {
        paused = true;
        clock += 1000;
        writeDirective(p.root, { feature: G, lane: "lane-1-1", action: "pause", run: h.run, now: new Date(clock) });
      }
      return { work: true };
    });
    for (let i = 0; i < 8; i++) await h.step();
    expect(h.s.lanes.map((l) => l.file.lane)).toEqual(["lane-1-1"]); // no stage 2 lane was created
    clock += 1000;
    writeDirective(p.root, { feature: G, lane: "lane-1-1", action: "continue", run: h.run, now: new Date(clock) });
    let out: unknown = null;
    for (let i = 0; i < 12 && out === null; i++) out = await h.step();
    expect(out).toMatchObject({ kind: "done" });
    expect(h.s.lanes.map((l) => l.file.lane)).toEqual(["lane-1-1", "lane-2-1"]);
  });
});

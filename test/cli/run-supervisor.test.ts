import { utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { writeMarker } from "../../src/core/activity.js";
import { readRun } from "../../src/core/fleet/index.js";
import { approveReassign } from "../../src/core/run-gate-actions.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, script, tickIn, type Harness } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

function report(h: Harness, lane: string, state: "working" | "waiting" | "blocked" | "paused" | "done", minutesAgo: number): void {
  const rt = h.lane(lane);
  writeMarker(rt.ref.root, {
    feature: F,
    agent: "claude",
    phase: "implement",
    at: new Date(h.clock.t - minutesAgo * 60_000).toISOString(),
    lane: rt.ref.name,
    state,
    run: h.run,
  });
}

/** Make a lane's tasks.md old, as it is when a lane was prepared long before the run. */
function age(h: Harness, lane: string, days = 1): void {
  const file = join(h.lane(lane).ref.root, "specs", F, "tasks.md");
  const t = new Date(h.clock.t - days * 86_400_000);
  utimesSync(file, t, t);
}

describe.skipIf(!HAS_GIT)("supervisor: stalls, restarts, reassignment (feature 028)", () => {
  it("028:SC-003: a hung lane that never reports is restarted within the stall limit plus one tick", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    const first = h.port.starts[0]!;
    h.advance(14);
    await h.step();
    expect(h.port.starts).toHaveLength(2); // nothing restarted yet
    h.advance(2);
    await h.step();
    expect(first.killed).toEqual(["SIGTERM"]);
    expect(h.port.starts).toHaveLength(4); // both hung lanes started again
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
    expect(readRun(p.root, h.run)!.lanes[0]!.restarts).toBe(1);
    expect(readEvents(p.root, h.run).some((e) => e.kind === "stalled" && e.lane === "lane-1-1")).toBe(true);
  });

  it("028:FR-008: a restart preserves the work: the new prompt lists only the tasks still open", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]); // the worker finished T001 before it hung
    h.advance(16);
    await h.step();
    const restart = h.port.starts.filter((x) => x.spec.cwd === h.lane("lane-1-1").ref.root)[1]!;
    expect(restart.spec.stdin).toContain("T003");
    expect(restart.spec.stdin).not.toContain("T001,");
    expect(restart.spec.stdin).not.toMatch(/T001/);
  });

  it("028:FR-008: a lane that reported recently is not stalled", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(20);
    report(h, "lane-1-1", "working", 3);
    report(h, "lane-1-2", "working", 3);
    await h.step();
    expect(h.port.starts).toHaveLength(2);
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
  });

  it("028:FR-008: a lane whose last report is older than the limit is stalled", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(20);
    report(h, "lane-1-1", "working", 18);
    report(h, "lane-1-2", "working", 1);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
    expect(h.lane("lane-1-2").file.restarts).toBe(0);
  });

  it("028:FR-010: waiting, blocked and paused lanes are never marked stalled", async () => {
    for (const state of ["waiting", "blocked", "paused"] as const) {
      const q = await preparedProject(F, 4, 2);
      const h = harness(q);
      script(h, q, { hang: true, work: false });
      await h.step();
      h.advance(60);
      report(h, "lane-1-1", state, 59);
      report(h, "lane-1-2", state, 59);
      await h.step();
      expect(h.lane("lane-1-1").file.restarts, state).toBe(0);
      expect(h.lane("lane-1-2").file.restarts, state).toBe(0);
    }
  });

  it("028:FR-008: a lane prepared long before the run is not stalled the moment its process starts", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    age(h, "lane-1-1");
    age(h, "lane-1-2");
    script(h, p, { hang: true, work: false });
    await h.step();
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
    h.advance(16);
    await h.step();
    expect(h.lane("lane-1-1").file.restarts).toBe(1);
  });

  it("028:FR-009: after the restart limit the lane pauses and asks a person instead of restarting again", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    for (let i = 0; i < 2; i++) {
      h.advance(16);
      await h.step();
    }
    expect(h.lane("lane-1-1").file.restarts).toBe(2);
    const startsBefore = h.port.starts.length;
    h.advance(16);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    expect(h.lane("lane-1-1").file.reason).toContain("a person must decide");
    expect(h.port.starts.length).toBe(startsBefore); // not started again
    const rec = readRun(p.root, h.run)!;
    expect(rec.status).toBe("waiting-person");
    expect(rec.needsDecision).toBe(true);
    expect(JSON.stringify(rec.escalations)).toContain("restart-limit");
    expect(h.said.join("\n")).toContain("ambykit directive");
  });

  it("028:FR-009: the restart limit is configurable", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { settings: { restartLimit: 0 } });
    script(h, p, { hang: true, work: false });
    await h.step();
    h.advance(16);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
  });

  it("028:FR-009: a lane never changes assistant on its own", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    for (let i = 0; i < 4; i++) {
      h.advance(16);
      await h.step();
    }
    expect(h.lane("lane-1-1").assistant).toBe("claude");
    expect(h.lane("lane-1-1").file.status).toBe("paused");
  });

  it("028:FR-009: with a person's approval a paused lane moves to the approved assistant and runs again", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    for (let i = 0; i < 3; i++) {
      h.advance(16);
      await h.step();
    }
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    const before = h.port.starts.length;
    const out = approveReassign(p.root, h.run, "lane-1-1", "codex", "person", new Date(h.clock.t + 1000));
    expect(out.ok).toBe(true);
    h.advance(1);
    await h.step();
    expect(h.lane("lane-1-1").assistant).toBe("codex");
    expect(h.lane("lane-1-1").file.restarts).toBe(0);
    expect(h.port.starts.length).toBe(before + 1);
    expect(readRun(p.root, h.run)!.lanes[0]!.assistant).toBe("codex");
    expect(readEvents(p.root, h.run).some((e) => e.kind === "reassigned")).toBe(true);
  });

  it("028:FR-009: an approval to move to an assistant with no verified runner is not applied", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { hang: true, work: false });
    await h.step();
    for (let i = 0; i < 3; i++) {
      h.advance(16);
      await h.step();
    }
    h.s.registry = h.s.registry.filter((r) => r.id !== "codex");
    approveReassign(p.root, h.run, "lane-1-1", "codex", "person", new Date(h.clock.t + 1000));
    h.advance(1);
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("paused");
    expect(h.lane("lane-1-1").assistant).toBe("claude");
    expect(h.said.join("\n")).toContain("cannot move");
  });

  it("028:FR-009: an approval for the wrong lane or assistant is refused by name", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    const out = approveReassign(p.root, h.run, "lane-9-9", "codex");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("lane-1-1");
  });

  it("028:US-3: a runner that exits at once with an error is a command mismatch, and that lane stops", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: false, exit: 2 });
    await h.step();
    await h.step();
    const file = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(file.status).toBe("failed");
    expect(file.reason).toContain("no longer match the installed version");
    expect(h.said.join("\n")).toContain("tool-compatibility");
  });
});

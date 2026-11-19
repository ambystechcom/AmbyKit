import { describe, expect, it } from "vitest";
import { readEvents } from "../../src/cli/run-files.js";
import { approveGate, rejectGate } from "../../src/core/run-gate-actions.js";
import { readRun } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, phasedProject, script } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

/** Phase 1 builds story 1, phase 2 builds story 2: a checkpoint between them. */
const twoStories = [
  { story: 1, tasks: 2 },
  { story: 2, tasks: 2 },
];

const workerStarts = (h: { port: { starts: { spec: { cwd: string } }[] } }, phase: number): number =>
  h.port.starts.filter((x) => x.spec.cwd.endsWith(`lane-${phase}-1`)).length;

describe.skipIf(!HAS_GIT)("story checkpoint gates in the run (feature 028)", () => {
  it("028:FR-015: the next prepared set does not start until a person approves the checkpoint", async () => {
    const p = await phasedProject(F, twoStories);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step(); // phase 1 starts and finishes
    await h.step(); // phase 1 merges; story US-1 is complete: the gate opens
    const rec = readRun(p.root, h.run)!;
    expect(rec.gates).toEqual([{ id: "phase-1", after: "US-1", state: "pending" }]);
    expect(rec.status).toBe("waiting-person");
    expect(workerStarts(h, 2)).toBe(0);
    for (let i = 0; i < 3; i++) await h.step();
    expect(workerStarts(h, 2)).toBe(0); // still waiting
    expect(h.said.join("\n")).toContain(`ambykit run approve ${h.run}`);
    approveGate(p.root, h.run, { by: "person" });
    await h.step();
    expect(workerStarts(h, 2)).toBe(1);
  });

  it("028:FR-015: with approval the run goes on and finishes with every lane merged", async () => {
    const p = await phasedProject(F, twoStories);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    approveGate(p.root, h.run, {});
    let out = null;
    for (let i = 0; i < 6 && !out; i++) out = (await h.step()) as typeof out;
    expect(out).toMatchObject({ kind: "done" });
    expect(readRun(p.root, h.run)!.status).toBe("done");
    expect(readEvents(p.root, h.run).filter((e) => e.kind === "merged")).toHaveLength(2);
  });

  it("028:FR-015: rejecting the checkpoint ends the run's waiting with the reason; approving it afterwards continues", async () => {
    const p = await phasedProject(F, twoStories);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    rejectGate(p.root, h.run, { reason: "story 1 is not done" });
    const out = (await h.step()) as { kind: string; message: string } | null;
    expect(out?.kind).toBe("rejected");
    expect(out?.message).toContain("story 1 is not done");
    expect(workerStarts(h, 2)).toBe(0);
    approveGate(p.root, h.run, {});
    await h.step();
    expect(workerStarts(h, 2)).toBe(1);
  });

  it("028:FR-015: unattended mode approves the checkpoint itself and records that it did", async () => {
    const p = await phasedProject(F, twoStories);
    const h = harness(p, { assistants: ["claude"], unattended: true });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    await h.step();
    expect(workerStarts(h, 2)).toBe(1);
    const rec = readRun(p.root, h.run)!;
    expect(rec.gates[0]!.state).toBe("approved");
    expect(rec.approvals[0]).toMatchObject({ kind: "gate", decision: "approved", by: "unattended" });
    expect(readEvents(p.root, h.run).some((e) => e.kind === "gate-approved")).toBe(true);
  });

  it("028:FR-015: a phase that completes no story (no story tags) has no checkpoint", async () => {
    const p = await phasedProject(F, [{ tasks: 2 }, { story: 1, tasks: 2 }]);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    await h.step();
    expect(readRun(p.root, h.run)!.gates).toEqual([]);
    expect(workerStarts(h, 2)).toBe(1);
  });

  it("028:FR-015: a story that is not finished until a later phase waits for the checkpoint after that phase", async () => {
    const p = await phasedProject(F, [{ story: 1, tasks: 2 }, { story: 1, tasks: 2 }]);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    await h.step();
    expect(readRun(p.root, h.run)!.gates).toEqual([]); // US-1 is still open after phase 1
    expect(workerStarts(h, 2)).toBe(1);
  });

  it("028:FR-015: non-parallel tasks of a finished phase are reported and the run pauses for a person", async () => {
    const p = await phasedProject(F, [{ story: 1, tasks: 2, stays: 1 }, { story: 2, tasks: 2 }]);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    const out = (await h.step()) as { kind: string; message: string } | null;
    expect(out?.kind).toBe("stays");
    expect(out?.message).toContain("T003");
    expect(out?.message).toContain("--continue-run");
    expect(readRun(p.root, h.run)!.status).toBe("waiting-person");
    expect(workerStarts(h, 2)).toBe(0);
  });

  it("028:FR-015: the gate never writes a directive", async () => {
    const p = await phasedProject(F, twoStories);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    approveGate(p.root, h.run, {});
    await h.step();
    const { existsSync } = await import("node:fs");
    const { directivesDir } = await import("../../src/core/fleet/index.js");
    expect(existsSync(directivesDir(p.root, h.run))).toBe(false);
  });
});

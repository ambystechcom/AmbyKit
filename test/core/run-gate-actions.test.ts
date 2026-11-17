import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { createRun, readRun, updateRun } from "../../src/core/fleet/index.js";
import {
  approveGate,
  approveReassign,
  completedStories,
  escalate,
  lastDecision,
  openGate,
  pendingGates,
  phaseGateId,
  rejectGate,
} from "../../src/core/run-gate-actions.js";
import { gitProject } from "../helpers/git-repo.js";
import { phase, tasksMd } from "../helpers/tasks-fixture.js";

const F = "028-ambykit-run";
const lanes = [{ lane: `${F}.lane-1-1`, assistant: "claude", tasks: ["T001"] }];

function run() {
  const root = gitProject([F]);
  const made = createRun(root, F, { lanes });
  if (!made.ok) throw new Error(made.warning);
  return { root, id: made.run.run };
}

describe("story checkpoint gates (feature 028)", () => {
  it("028:FR-015: a phase whose stories are all checked off is a checkpoint; a story still open elsewhere is not", () => {
    const tasks = parseTasks(
      tasksMd([
        phase(1, [
          { id: "T001", story: 1, done: true },
          { id: "T002", story: 2, done: true },
        ]),
        phase(2, [{ id: "T003", story: 2, done: false }]),
      ]),
    );
    expect(completedStories(tasks, 1)).toEqual(["US-1"]);
    expect(completedStories(tasks, 2)).toEqual([]);
  });

  it("028:FR-015: a phase with no story tags (setup, polish) has no checkpoint", () => {
    const tasks = parseTasks(tasksMd([phase(1, [{ id: "T001", done: true }])]));
    expect(completedStories(tasks, 1)).toEqual([]);
  });

  it("028:FR-015: opening a gate records it pending in run.json and puts the run on a person; opening twice is a no-op", () => {
    const { root, id } = run();
    const a = openGate(root, id, 1, ["US-1", "US-2"]);
    expect(a.ok && a.gate).toEqual({ id: "phase-1", after: "US-1, US-2", state: "pending" });
    expect(openGate(root, id, 1, ["US-1"]).ok).toBe(true);
    const rec = readRun(root, id)!;
    expect(rec.gates).toHaveLength(1);
    expect(rec.status).toBe("waiting-person");
    expect(rec.needsDecision).toBe(true);
    expect(pendingGates(rec)).toHaveLength(1);
    expect(phaseGateId(1)).toBe("phase-1");
  });

  it("028:FR-015: approving updates the gate through spec 025's store, records who and when, and puts the run back to active", () => {
    const { root, id } = run();
    openGate(root, id, 1, ["US-1"]);
    const out = approveGate(root, id, { by: "person", reason: "looks right", now: new Date("2026-11-16T10:00:00Z") });
    expect(out.ok).toBe(true);
    const rec = readRun(root, id)!;
    expect(rec.gates[0]!.state).toBe("approved");
    expect(rec.status).toBe("active");
    expect(rec.needsDecision).toBe(false);
    expect(rec.approvals[0]).toMatchObject({ kind: "gate", gate: "phase-1", decision: "approved", by: "person", reason: "looks right", at: "2026-11-16T10:00:00.000Z" });
    expect(lastDecision(rec, "phase-1")?.decision).toBe("approved");
  });

  it("028:FR-015: rejecting keeps the gate pending, records the reason and pauses the run", () => {
    const { root, id } = run();
    openGate(root, id, 1, ["US-1"]);
    const out = rejectGate(root, id, { reason: "the story is not done" });
    expect(out.ok).toBe(true);
    const rec = readRun(root, id)!;
    expect(rec.gates[0]!.state).toBe("pending");
    expect(rec.status).toBe("paused");
    expect(lastDecision(rec, "phase-1")).toMatchObject({ decision: "rejected", reason: "the story is not done" });
  });

  it("028:FR-015: a rejected gate can still be approved later, and the later decision is the one that counts", () => {
    const { root, id } = run();
    openGate(root, id, 1, ["US-1"]);
    rejectGate(root, id, {});
    approveGate(root, id, {});
    const rec = readRun(root, id)!;
    expect(rec.gates[0]!.state).toBe("approved");
    expect(rec.status).toBe("active");
    expect(lastDecision(rec, "phase-1")?.decision).toBe("approved");
  });

  it("028:FR-015: with no gate waiting, approving says so by name", () => {
    const { root, id } = run();
    const out = approveGate(root, id, {});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("no gate waiting");
  });

  it("028:FR-015: with several gates waiting, a gate must be named, and a wrong name lists the real ones", () => {
    const { root, id } = run();
    openGate(root, id, 1, ["US-1"]);
    openGate(root, id, 2, ["US-2"]);
    const none = approveGate(root, id, {});
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toContain("phase-1, phase-2");
    expect(approveGate(root, id, { gate: "phase-2" }).ok).toBe(true);
    const wrong = rejectGate(root, id, { gate: "phase-9" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toContain("phase-1");
  });

  it("028:FR-015: an unknown run is refused by name", () => {
    const { root } = run();
    const out = approveGate(root, `${F}.9`, {});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain(`${F}.9`);
  });

  it("028:FR-015: the gate pair does not touch directives: no directive file is written", async () => {
    const { root, id } = run();
    openGate(root, id, 1, ["US-1"]);
    approveGate(root, id, {});
    const { existsSync } = await import("node:fs");
    const { directivesDir } = await import("../../src/core/fleet/index.js");
    expect(existsSync(directivesDir(root, id))).toBe(false);
  });

  it("028:FR-009: a person's approval to move a lane is recorded against a lane the run has", () => {
    const { root, id } = run();
    const ok = approveReassign(root, id, "lane-1-1", "codex", "person", new Date("2026-11-16T10:00:00Z"));
    expect(ok.ok).toBe(true);
    expect(readRun(root, id)!.approvals[0]).toMatchObject({ kind: "reassign", lane: "lane-1-1", to: "codex" });
    expect(approveReassign(root, id, "1-1", "codex").ok).toBe(true);
    expect(approveReassign(root, id, "lane-4-4", "codex").ok).toBe(false);
  });

  it("028:FR-012: escalating records why a person is needed and moves the run to waiting-person", () => {
    const { root, id } = run();
    updateRun(root, id, { status: "active" });
    escalate(root, id, { kind: "merge-conflict", lane: "lane-1-1" });
    const rec = readRun(root, id)!;
    expect(rec.status).toBe("waiting-person");
    expect(rec.needsDecision).toBe(true);
    expect(rec.escalations[0]).toMatchObject({ kind: "merge-conflict", lane: "lane-1-1" });
  });
});

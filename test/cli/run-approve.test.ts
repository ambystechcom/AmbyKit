import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { createRun, readRun } from "../../src/core/fleet/index.js";
import { openGate } from "../../src/core/run-gate-actions.js";
import { gitProject } from "../helpers/git-repo.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

function waiting() {
  const root = gitProject([F]);
  const made = createRun(root, F, { lanes: [{ lane: `${F}.lane-1-1`, assistant: "claude", tasks: ["T001"] }] });
  if (!made.ok) throw new Error(made.warning);
  openGate(root, made.run.run, 1, ["US-1"]);
  return { root, id: made.run.run };
}

describe("ambykit run approve and reject (feature 028)", () => {
  it("028:FR-015: approve records the decision and tells the person the run goes on", async () => {
    const { root, id } = waiting();
    const r = await runCommand(new RunCommand(), root, ["approve", id]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Approved phase-1");
    const rec = readRun(root, id)!;
    expect(rec.gates[0]!.state).toBe("approved");
    expect(rec.approvals[0]).toMatchObject({ decision: "approved", by: "person" });
  });

  it("028:FR-015: reject records the reason and pauses the run", async () => {
    const { root, id } = waiting();
    const r = await runCommand(new RunCommand(), root, ["reject", id], { reason: "not yet" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("not yet");
    const rec = readRun(root, id)!;
    expect(rec.status).toBe("paused");
    expect(rec.approvals[0]).toMatchObject({ decision: "rejected", reason: "not yet" });
  });

  it("028:FR-015: --json gives the decision and the run status", async () => {
    const { root, id } = waiting();
    const r = await runCommand(new RunCommand(), root, ["approve", id], { json: true });
    expect(JSON.parse(r.out)).toEqual({ run: id, gate: "phase-1", decision: "approved", status: "active" });
  });

  it("028:FR-015: --gate names which checkpoint when several wait", async () => {
    const { root, id } = waiting();
    openGate(root, id, 2, ["US-2"]);
    const bare = await runCommand(new RunCommand(), root, ["approve", id]);
    expect(bare.code).toBe(1);
    expect(bare.err).toContain("--gate=<id>");
    const named = await runCommand(new RunCommand(), root, ["approve", id], { gate: "phase-2" });
    expect(named.code).toBe(0);
    expect(readRun(root, id)!.gates.map((g) => g.state)).toEqual(["pending", "approved"]);
  });

  it("028:FR-015: an unknown run or a missing run is refused", async () => {
    const { root } = waiting();
    const unknown = await runCommand(new RunCommand(), root, ["approve", `${F}.9`]);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain(`${F}.9`);
    const missing = await runCommand(new RunCommand(), root, ["approve"]);
    expect(missing.code).toBe(1);
    expect(missing.err).toContain("Missing run");
  });

  it("028:FR-015: with nothing waiting, approve says so and changes nothing", async () => {
    const { root, id } = waiting();
    await runCommand(new RunCommand(), root, ["approve", id]);
    const again = await runCommand(new RunCommand(), root, ["approve", id]);
    expect(again.code).toBe(1);
    expect(again.err).toContain("no gate waiting");
    expect(readRun(root, id)!.approvals).toHaveLength(1);
  });

  it("028:FR-009: approve --reassign records a person's approval for a lane to move assistants", async () => {
    const { root, id } = waiting();
    const r = await runCommand(new RunCommand(), root, ["approve", id], { reassign: "lane-1-1:codex" });
    expect(r.code).toBe(0);
    expect(readRun(root, id)!.approvals.at(-1)).toMatchObject({ kind: "reassign", lane: "lane-1-1", to: "codex" });
    const bad = await runCommand(new RunCommand(), root, ["approve", id], { reassign: "nonsense" });
    expect(bad.code).toBe(1);
    const wrongVerb = await runCommand(new RunCommand(), root, ["reject", id], { reassign: "lane-1-1:codex" });
    expect(wrongVerb.code).toBe(1);
  });

  it("028:FR-015: the verb needs no feature and no lanes: it works from any terminal on the project", async () => {
    const { root, id } = waiting();
    const r = await runCommand(new RunCommand(), root, ["approve", id]);
    expect(r.err).not.toContain("experimental");
    expect(r.code).toBe(0);
  });
});

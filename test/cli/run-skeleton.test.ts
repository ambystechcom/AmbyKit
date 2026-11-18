import { describe, expect, it } from "vitest";
import { EXPERIMENTAL_NOTE, RunCommand } from "../../src/cli/run.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { addLane, laneProject } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";
import { gitProject } from "../helpers/git-repo.js";

const F = "028-ambykit-run";
const par = (n: number): TaskDef => ({ id: `T00${n}`, parallel: true, paths: [`src/f${n}.ts`] });

describe("ambykit run skeleton (feature 028)", () => {
  it("028:FR-019: the verb is labelled experimental in its summary and in the banner", async () => {
    expect(new RunCommand().summary).toContain("experimental");
    expect(EXPERIMENTAL_NOTE).toContain("2.0");
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, [F]);
    expect(r.err).toContain("experimental");
  });

  it("028:FR-019: --json output carries no banner text", async () => {
    const p = HAS_GIT ? laneProject(F, tasksMd([phase(1, [par(1)])])) : null;
    if (!p) return;
    addLane(p, 1, 1);
    const r = await runCommand(new RunCommand(), p.root, [F], { json: true });
    expect(r.err).not.toContain("experimental");
  });

  it("028:FR-001: without a feature it says what is missing and exits 1", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, []);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Missing feature");
  });

  it("028:FR-001: an unknown feature is refused by name", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, ["999-nope"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("999-nope");
  });

  it("028:FR-001: a feature with no prepared lanes points at ambykit lane", async () => {
    const root = gitProject([F]);
    const r = await runCommand(new RunCommand(), root, [F]);
    expect(r.code).toBe(1);
    expect(r.err).toContain(`ambykit lane ${F}`);
  });
});

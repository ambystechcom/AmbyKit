import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { bootstrapRun, readEvents, readLaneFile, readRunLock } from "../../src/cli/run-files.js";
import { listRuns, readRun } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, preparedProject, script } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";
const noSleep = async (): Promise<void> => undefined;

describe.skipIf(!HAS_GIT)("ambykit run --yes end to end with fake assistants (feature 028)", () => {
  // One full --yes run on one project; the assertions below were four separate runs on the same (4, 2) project.
  it(
    "028:FR-004, 028:FR-017: two lanes run on two assistants in separate worktrees and the run finishes with both merged; " +
      "the lock is released, the state lives under .amby/fleet/<run>/, and the record shows the lanes in spec 025's shape",
    async () => {
      const p = await preparedProject(F, 4, 2);
      const port = new FakePort();
      script({ port }, p, { work: true });
      const cmd = new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep });
      const r = await runCommand(cmd, p.root, [F], { yes: true, assistant: "claude,codex" });
      // 028:FR-004 two lanes, two assistants, separate worktrees, both merged
      expect(r.err, "FR-004: no lane may be reported as not started").not.toContain("not started");
      expect(r.code).toBe(0);
      const run = listRuns(p.root, F)[0]!;
      expect(run.run).toBe(`${F}.1`);
      expect(run.status).toBe("done");
      expect(readLaneFile(p.root, run.run, "lane-1-1")).toMatchObject({ status: "merged", assistant: "claude" });
      expect(readLaneFile(p.root, run.run, "lane-1-2")).toMatchObject({ status: "merged", assistant: "codex" });
      const workers = port.starts.filter((h) => /check each off/.test(h.spec.stdin ?? ""));
      expect(workers).toHaveLength(2);
      expect(new Set(workers.map((h) => h.spec.cwd)).size).toBe(2);
      expect(readEvents(p.root, run.run).filter((e) => e.kind === "merged")).toHaveLength(2);
      // 028:FR-017 the run lock is released when the run ends
      expect(readRunLock(p.root, `${F}.1`), "FR-017: the run lock must be released").toBeNull();
      // 028:FR-017 the run's state lives under .amby/fleet/<run>/ and nothing is written outside the project
      const dir = join(p.root, ".amby", "fleet", `${F}.1`);
      for (const f of ["run.json", "events.jsonl", "budget.json", "lanes/lane-1-1.json", "prompts/lane-1-1.md"]) {
        expect(existsSync(join(dir, f)), `FR-017: ${f} must exist under .amby/fleet/<run>/`).toBe(true);
      }
      // 028:FR-017 a run record shows the lanes it was started with, in spec 025's shape
      const rec = readRun(p.root, `${F}.1`)!;
      expect(rec.lanes.map((l) => l.lane)).toEqual([`${F}.lane-1-1`, `${F}.lane-1-2`]);
      expect(rec.lanes[0]).toMatchObject({ assistant: "claude", tasks: ["T001", "T003"] });
      expect(rec.feature).toBe(F);
    },
    60_000,
  );

  it("028:FR-017: a second run on a feature that has an unfinished run refuses and points at --continue-run", async () => {
    const p = await preparedProject(F, 4, 2);
    bootstrapRun(p.root, F, [{ lane: `${F}.lane-1-1`, assistant: "claude", tasks: ["T001"] }], () => false);
    const port = new FakePort();
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain(`--continue-run=${F}.1`);
    expect(port.starts).toHaveLength(0);
    expect(listRuns(p.root, F)).toHaveLength(1);
  });

  it("028:FR-001: --json launch output is machine readable and ends with the outcome", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true, json: true });
    const lines = r.out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(lines[0].launched).toBe(false);
    expect(lines.at(-1)).toMatchObject({ run: `${F}.1`, outcome: "done" });
  });
});

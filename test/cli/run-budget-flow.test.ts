import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { readRun } from "../../src/core/fleet/index.js";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, preparedProject, script } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

/** A clock that moves only when the loop sleeps, so a run of hours takes milliseconds. */
function clock(minutesPerSleep: number) {
  let t = Date.now();
  return { now: () => t, sleep: async (): Promise<void> => void (t += minutesPerSleep * 60_000) };
}

describe.skipIf(!HAS_GIT)("budgets inside ambykit run (feature 028)", () => {
  it("028:SC-004: a tiny wall-clock budget stops the run, records why and tells the person how to continue", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { hang: true, work: false });
    const c = clock(2);
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, ...c }), p.root, [F], { yes: true, "max-minutes": "1" });
    expect(r.code).toBe(1);
    expect(r.err + r.out).toContain("Budget exceeded: wall-clock budget of 1 minutes exceeded");
    expect(r.err).toContain(`--continue-run=${F}.1`);
    const rec = readRun(p.root, `${F}.1`)!;
    expect(rec.status).toBe("paused");
    expect(JSON.stringify(rec.escalations)).toContain("wall-clock");
    expect(readLaneFile(p.root, rec.run, "lane-1-1")!.status).toBe("stopped");
    expect(readEvents(p.root, rec.run).some((e) => e.kind === "budget-exceeded")).toBe(true);
  });

  // Tests 2-5 only read what a run prints about its budgets before it launches, and the budget line appears without --yes
  // (the config test already ran that way), so they share one prepared project in preview mode instead of four full runs.
  it(
    "028:FR-013: the defaults are shown at the start of a run; a token ceiling the runner cannot report is stated, not silently ignored; " +
      "a runner that reports usage gets no not-enforceable notice; budgets set in .amby/config.json are used and flags override them",
    async () => {
      const p = await preparedProject(F, 4, 2);
      const port = new FakePort();
      const run = (registry: ReturnType<typeof fakeRegistry>, flags: Record<string, unknown> = {}) =>
        runCommand(new RunCommand({ registry, port }), p.root, [F], flags);
      // the defaults are shown at the start of a run
      const d = await run(fakeRegistry());
      expect(d.out, "FR-013: default budgets").toContain("Budgets: 120 minutes wall-clock, 8 task events");
      // a token ceiling the runner cannot report is stated at the start, not silently ignored
      const nt = await run(fakeRegistry(), { "max-tokens": "5000" });
      expect(nt.out).toContain("5000 tokens");
      expect(nt.out).toContain("not enforceable for this runner");
      expect(nt.code).toBe(0);
      // a runner that reports usage gets no not-enforceable notice
      const ut = await run(fakeRegistry(["claude", "codex"], true), { "max-tokens": "5000" });
      expect(ut.out, "FR-013: a usage-reporting runner").not.toContain("not enforceable");
      // budgets set in .amby/config.json are used, and flags override them (last: it changes the config)
      const { writeFileSync, readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const file = join(p.root, ".amby", "config.json");
      writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), fleet: { budgets: { wallClockMinutes: 45, maxTasks: 20 } } }) + "\n");
      const a = await run(fakeRegistry());
      expect(a.out).toContain("45 minutes wall-clock, 20 task events");
      const b = await run(fakeRegistry(), { "max-tasks": "6" });
      expect(b.out).toContain("45 minutes wall-clock, 6 task events");
    },
    60_000,
  );
});

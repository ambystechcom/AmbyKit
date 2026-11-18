import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { parseTasks } from "../../src/core/dashboard.js";
import { readRun } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, configure, fakeRegistry, preparedProject, script } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";
const noSleep = async (): Promise<void> => undefined;
const isWorker = (prompt: string): boolean => /check each off/.test(prompt);

describe.skipIf(!HAS_GIT)("the team protocol before merge, inside ambykit run (feature 028)", () => {
  it("028:FR-018: reviews run before each merge: no lane merges until QA and the architect passed it", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true, verdict: "pass" });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true });
    expect(r.code).toBe(0);
    const events = readEvents(p.root, `${F}.1`);
    for (const lane of ["lane-1-1", "lane-1-2"]) {
      const kinds = events.filter((e) => e.lane === lane).map((e) => e.kind);
      expect(kinds.indexOf("review-started"), lane).toBeGreaterThan(-1);
      expect(kinds.indexOf("review-started")).toBeLessThan(kinds.indexOf("merged"));
      expect(kinds.indexOf("review-passed")).toBeLessThan(kinds.indexOf("merged"));
    }
  });

  it("028:SC-009: a lane whose Verify line failed is never merged, even when both reviewers pass it", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, (cwd, prompt) => {
      if (isWorker(prompt) && cwd.endsWith("lane-1-1")) {
        const file = join(cwd, "specs", F, "tasks.md");
        writeFileSync(file, readFileSync(file, "utf8").replace(/\n*$/, "\n") + "**Verify:** `npm test` passes ✗ failed: 3 tests fail\n");
      }
      return { work: true, verdict: "pass" };
    });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err + r.out).toContain("Verify");
    expect(r.err + r.out).toContain("3 tests fail");
    const lane1 = readLaneFile(p.root, `${F}.1`, "lane-1-1")!;
    expect(lane1.status).toBe("unfinished");
    expect(readLaneFile(p.root, `${F}.1`, "lane-1-2")!.status).toBe("merged");
    const feature = parseTasks(readFileSync(join(p.featureRoot, "specs", F, "tasks.md"), "utf8"));
    expect(feature.find((t) => t.id === "T001")!.done).toBe(false);
    expect(feature.find((t) => t.id === "T002")!.done).toBe(true);
  });

  it("028:SC-009: a QA failure is fixed in the same lane within the round limit, and then the lane merges", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    let failedOnce = false;
    script({ port }, p, (cwd, prompt) => {
      const qa = /Act as the qa reviewer/.test(prompt) && cwd.endsWith("lane-1-1");
      if (qa && !failedOnce) {
        failedOnce = true;
        return { work: true, verdict: ["QA-9"] };
      }
      return { work: true, verdict: "pass" };
    });
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("lane-1-1: qa review failed (QA-9); back to the worker");
    const fixes = port.starts.filter((x) => /Fix exactly these review findings/.test(x.spec.stdin ?? ""));
    expect(fixes).toHaveLength(1);
    expect(fixes[0]!.spec.stdin).toContain("QA-9");
    expect(readRun(p.root, `${F}.1`)!.status).toBe("done");
  });

  it("028:SC-009: a loop that cannot converge ends within the round limit and asks a person; the run does not spin", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { fleet: { roundLimit: 2 } });
    const port = new FakePort();
    script({ port }, p, (cwd) => ({ work: true, verdict: cwd.endsWith("lane-1-1") ? ["NEVER-1"] : "pass" }));
    let sleeps = 0;
    const sleep = async (): Promise<void> => {
      sleeps += 1;
      if (sleeps > 40) throw new Error("the run kept polling: it should have asked a person and stopped waiting on its own lanes");
    };
    // a person's wall-clock budget ends the wait: the run stops with the escalation recorded
    const t = { v: Date.now() };
    const r = await runCommand(
      new RunCommand({ registry: fakeRegistry(), port, now: () => t.v, sleep: async () => { t.v += 30 * 60_000; await sleep(); } }),
      p.root,
      [F],
      { yes: true, "max-minutes": "600" },
    );
    expect(r.code).toBe(1);
    const rec = readRun(p.root, `${F}.1`)!;
    expect(JSON.stringify(rec.escalations)).toContain("NEVER-1");
    expect(JSON.stringify(rec.escalations)).toContain("wall-clock");
    const reviewers = port.starts.filter((x) => x.spec.cwd.endsWith("lane-1-1") && /reviewer:/.test(x.spec.stdin ?? ""));
    expect(reviewers.length).toBeLessThanOrEqual(2); // QA fails first each round: at most 2 rounds
    expect(readLaneFile(p.root, rec.run, "lane-1-1")!.status).not.toBe("merged");
  });

  it("028:FR-018: reviewers use the lane's own assistant", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, { work: true, verdict: "pass" });
    await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), p.root, [F], { yes: true, assistant: "claude,codex" });
    const rec = readRun(p.root, `${F}.1`)!;
    expect(rec.lanes.map((l) => l.assistant)).toEqual(["claude", "codex"]);
    expect(port.starts.filter((x) => /reviewer:/.test(x.spec.stdin ?? "")).length).toBe(4);
  });
});

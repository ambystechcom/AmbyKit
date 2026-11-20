import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { readLaneFile } from "../../src/cli/run-files.js";
import { readRun } from "../../src/core/fleet/index.js";
import { commitFile } from "../helpers/lane-fixture.js";
import { gitRun, HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, harness, preparedProject, script, tickIn } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";
import { install16, run16Dir, type Run16 } from "../helpers/run-1.6-fixture.js";

/**
 * Feature 033 (US-6, FR-012): a run directory written by the v1.6.0 build resumes in 2.0 without repeating completed work. Each scenario
 * is set up in a project in the git state the run left (the 2.x harness does the lane work), the run's state directory is then replaced
 * by the files 1.6.0 itself wrote (test/fixtures/run-1.6/), and the run is continued with `--continue-run`. The same continuation from
 * the state 2.x wrote is the control: both must end the same way.
 */

const F = "028-ambykit-run";
const noSleep = async (): Promise<void> => undefined;
const isWorker = (x: { spec: { stdin?: string } }): boolean => /check each off/.test(x.spec.stdin ?? "");

interface Outcome {
  code: number;
  out: string;
  workers: { lane: string; stdin: string }[];
  runStatus: string | undefined;
  lanes: Record<string, string>;
}

async function continueRun(root: string, run: string, port: FakePort, flags: Record<string, string | boolean> = {}): Promise<Outcome> {
  const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep }), root, [], { "continue-run": run, yes: true, ...flags });
  const workers = port.starts.filter(isWorker).map((x) => ({ lane: /lane-\d+-\d+$/.exec(x.spec.cwd)?.[0] ?? x.spec.cwd, stdin: x.spec.stdin ?? "" }));
  const lanes: Record<string, string> = {};
  for (const l of ["lane-1-1", "lane-1-2"]) lanes[l] = readLaneFile(root, run, l)?.status ?? "missing";
  return { code: r.code, out: r.out, workers, runStatus: readRun(root, run)?.status, lanes };
}

/** Put the 1.6.0 files in place and prove they are what the run now reads (its creation time is the fixture's, not this test's). */
function installAndCheck(root: string, run: string, kind: Run16): void {
  install16(root, run, kind);
  const written = JSON.parse(readFileSync(join(run16Dir(kind), "run.json"), "utf8")) as { createdAt: string };
  expect(readRun(root, run)!.createdAt).toBe(written.createdAt);
}

/** Interrupted mid-run: two lanes started, lane 1-1 had checked T001 off; then 2.x continues it. */
async function midRun(from16: boolean): Promise<Outcome> {
  const p = await preparedProject(F, 4, 2);
  const h = harness(p);
  script(h, p, { hang: true, work: false });
  await h.step();
  tickIn(h.lane("lane-1-1").ref.root, F, ["T001"]);
  h.sup.interrupt();
  if (from16) installAndCheck(p.root, h.run, "interrupted-mid-run");
  const port = new FakePort();
  script({ port }, p, { work: true });
  return continueRun(p.root, h.run, port);
}

/** Interrupted mid-merge: lane 1-1 merged, lane 1-2 in conflict; a person resolves it; then 2.x continues. */
async function midMerge(from16: boolean): Promise<Outcome & { shared: string }> {
  const p = await preparedProject(F, 4, 2);
  const h = harness(p);
  const lane1 = h.lane("lane-1-1");
  const lane2 = h.lane("lane-1-2");
  tickIn(lane1.ref.root, F, ["T001", "T003"]);
  commitFile(lane1.ref.root, "src/one.ts", "one\n", "lane 1 work");
  tickIn(lane2.ref.root, F, ["T002", "T004"]);
  commitFile(lane2.ref.root, "shared.txt", "from lane\n", "lane 2 work");
  commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");
  lane1.file.status = "ready";
  lane2.file.status = "ready";
  await h.step();
  expect(lane2.file.status).toBe("conflict");
  try {
    gitRun(lane2.ref.root, ["merge", F]);
  } catch {
    writeFileSync(join(lane2.ref.root, "shared.txt"), "resolved\n");
    gitRun(lane2.ref.root, ["add", "-A"]);
    gitRun(lane2.ref.root, ["commit", "-q", "-m", "resolve"]);
  }
  if (from16) installAndCheck(p.root, h.run, "interrupted-mid-merge");
  const port = new FakePort();
  script({ port }, p, { work: true });
  // Every task is already checked, so the default task budget (twice the open tasks) would stop the run at once: give it room.
  const out = await continueRun(p.root, h.run, port, { "max-tasks": "20" });
  return { ...out, shared: readFileSync(join(p.featureRoot, "shared.txt"), "utf8") };
}

describe.skipIf(!HAS_GIT)("a run written by 1.6.0 resumes in 2.0 (feature 033, US-6)", () => {
  it("033:FR-012: the fixtures are the v1.6.0 run directories", () => {
    for (const kind of ["interrupted-mid-run", "interrupted-mid-merge"] as Run16[]) {
      expect(existsSync(join(run16Dir(kind), "run.json")), kind).toBe(true);
      expect(existsSync(join(run16Dir(kind), "lanes", "lane-1-1.json")), kind).toBe(true);
    }
    expect(JSON.parse(readFileSync(join(run16Dir("interrupted-mid-run"), "run.json"), "utf8"))).toMatchObject({ run: `${F}.1`, status: "paused" });
    expect(JSON.parse(readFileSync(join(run16Dir("interrupted-mid-merge"), "run.json"), "utf8"))).toMatchObject({ status: "waiting-person" });
  });

  it(
    "033:FR-012: continuing a run interrupted mid-run repeats no completed task and finishes, exactly as from the state 2.x wrote",
    async () => {
      const control = await midRun(false);
      const old = await midRun(true);
      expect(old.code).toBe(0);
      expect(old.runStatus).toBe("done");
      const lane1 = old.workers.find((w) => w.lane === "lane-1-1")!;
      expect(lane1.stdin).toContain("T003");
      expect(lane1.stdin, "T001 was done before the interrupt").not.toContain("T001");
      expect(old.out).toContain("Continuing run");
      expect({ ...old, out: "" }).toEqual({ ...control, out: "" });
    },
    90_000,
  );

  it(
    "033:FR-012: continuing a run interrupted mid-merge does not start the merged lane again, merges the resolved one and finishes",
    async () => {
      const control = await midMerge(false);
      const old = await midMerge(true);
      expect(old.code).toBe(0);
      expect(old.runStatus).toBe("done");
      expect(old.lanes).toEqual({ "lane-1-1": "merged", "lane-1-2": "merged" });
      expect(old.workers.some((w) => w.lane === "lane-1-1"), "the merged lane must not run again").toBe(false);
      expect(old.shared).toBe("resolved\n");
      expect({ ...old, out: "" }).toEqual({ ...control, out: "" });
    },
    90_000,
  );

  it("033:FR-012: the 1.6.0 files carry nothing that names the machine that generated them", () => {
    for (const kind of ["interrupted-mid-run", "interrupted-mid-merge"] as Run16[]) {
      const text = [join(run16Dir(kind), "run.json"), join(run16Dir(kind), "events.jsonl")].map((f) => readFileSync(f, "utf8")).join("\n");
      expect(text, kind).not.toMatch(/AppData|C:\\|\/tmp\//);
    }
  });
});

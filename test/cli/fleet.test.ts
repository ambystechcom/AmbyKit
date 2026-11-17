import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FleetCommand } from "../../src/cli/fleet.js";
import { writeMarker } from "../../src/core/activity.js";
import { readClaims } from "../../src/core/fleet/claims.js";
import { readDirective } from "../../src/core/fleet/directives.js";
import { readNotes } from "../../src/core/fleet/notes.js";
import { createRun, listRuns, readRun, runDir } from "../../src/core/fleet/runs.js";
import { tickTask } from "../../src/core/tasks-edit.js";
import { project } from "../mcp/fixture.js";

const FEATURE = "001-alpha";

/** A project with a ready spec, a plan, and tasks in two phases (T001, T002 | T003). */
function make(config: Record<string, unknown> = {}, opts: { plan?: boolean; done?: number[] } = {}): string {
  const done = new Set(opts.done ?? []);
  const root = project(
    [
      {
        dir: FEATURE,
        stories: [{ n: 1 }],
        phases: [
          { title: "One", tasks: [{ id: "T001", story: 1, done: done.has(1), paths: ["src/a.ts"] }, { id: "T002", story: 1, done: done.has(2), paths: ["src/b.ts"] }] },
          { title: "Two", tasks: [{ id: "T003", story: 1, done: done.has(3), paths: ["src/c.ts"] }] },
        ],
      },
    ],
    config,
  );
  if (opts.plan !== false) writeFileSync(join(root, "specs", FEATURE, "plan.md"), "# Plan\n");
  return root;
}

async function fleet(cwd: string, positionals: string[], flags: Record<string, string | boolean> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await new FleetCommand().run({ cwd, positionals, flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
}

const start = async (root: string, flags: Record<string, string | boolean> = {}) => fleet(root, ["start", "001"], flags);
const update = async (root: string, flags: Record<string, string | boolean>) => fleet(root, ["update", "001"], flags);
const tasksFile = (root: string) => join(root, "specs", FEATURE, "tasks.md");
const statusJson = async (root: string, flags: Record<string, string | boolean> = {}) => JSON.parse((await fleet(root, ["status", "001"], { json: true, ...flags })).out);

describe("fleet start", () => {
  it("019:FR-014: creates run <feature>.1 at the first incomplete phase, only on this explicit call", async () => {
    const root = make();
    expect(listRuns(root, FEATURE)).toHaveLength(0);
    const r = await start(root);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${FEATURE}.1`);
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ status: "active", phase: 1, stage: "working", round: 0, limit: 3, needsDecision: false });
    expect(readFileSync(join(root, ".amby", "fleet", ".gitignore"), "utf8")).toContain("*");
  });

  it("019:FR-014: a second start is refused while one is unfinished, naming it; --new starts <feature>.2", async () => {
    const root = make();
    await start(root);
    const again = await start(root);
    expect(again.code).toBe(1);
    expect(again.err).toContain(`${FEATURE}.1`);
    expect(listRuns(root, FEATURE)).toHaveLength(1);
    const fresh = await start(root, { new: true });
    expect(fresh.code).toBe(0);
    expect(listRuns(root, FEATURE).map((x) => x.run)).toEqual([`${FEATURE}.1`, `${FEATURE}.2`]);
  });

  it("019:FR-002: starts nothing for a draft spec, a missing plan or a missing tasks.md, and names the artifact", async () => {
    const noPlan = make({}, { plan: false });
    const a = await start(noPlan);
    expect(a.code).toBe(1);
    expect(a.err).toContain("plan.md");
    expect(listRuns(noPlan, FEATURE)).toHaveLength(0);

    const draft = make();
    const spec = join(draft, "specs", FEATURE, "spec.md");
    writeFileSync(spec, readFileSync(spec, "utf8").replace("status: ready", "status: draft"));
    const b = await start(draft);
    expect(b.code).toBe(1);
    expect(b.err).toContain("draft");

    const noTasks = make();
    rmSync(tasksFile(noTasks));
    expect((await start(noTasks)).err).toContain("tasks.md");
  });

  it("019:FR-003: a finished feature starts no run and changes nothing", async () => {
    const root = make({}, { done: [1, 2, 3] });
    // every phase has a Verify line, so mark each one passed
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replaceAll("**Verify:** run the checks", "**Verify:** run the checks ✓ passed"));
    const r = await start(root);
    expect(r.code).toBe(0);
    expect(r.out).toContain("already done");
    expect(listRuns(root, FEATURE)).toHaveLength(0);
  });

  it("019:FR-001: starts at the phase the tasks are at, and resumes it (QA when the phase is fully checked)", async () => {
    const root = make({}, { done: [1, 2] });
    await start(root);
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ phase: 1, stage: "qa" });
  });
});

describe("fleet status", () => {
  it("019:FR-014: with no run it says so and names the next phase; with one it prints it; with several it names them", async () => {
    const root = make();
    const none = await fleet(root, ["status", "001"]);
    expect(none.code).toBe(0);
    expect(none.out).toContain("no unfinished run");
    expect(none.out).toContain("phase 1 (working): T001, T002 pending");

    await start(root);
    const one = await fleet(root, ["status", "001"]);
    expect(one.out).toContain(`${FEATURE}.1  active  phase 1 working  round 0/3`);

    await start(root, { new: true });
    const many = await fleet(root, ["status", "001"]);
    expect(many.out).toMatch(/several unfinished runs.*\.1.*\.2/);
    expect((await fleet(root, ["status", "001"], { run: `${FEATURE}.2` })).out).toContain(`${FEATURE}.2  active`);
  });

  it("019:FR-026, 019:FR-027: defaults come from the fleet config object; an absent object means 3 total and 2 per type", async () => {
    const root = make();
    await start(root);
    expect((await statusJson(root)).slots).toMatchObject({ free: 3 });
    const small = make({ fleet: { concurrency: { total: 1, perType: 1 }, roundLimit: 2 } });
    await start(small);
    expect((await statusJson(small)).slots).toMatchObject({ free: 1 });
    expect(readRun(small, `${FEATURE}.1`)).toMatchObject({ limit: 2 });
  });

  it("019:SC-004: state is plain files a person can read: run.json is the schema in 025's data-model", async () => {
    const root = make();
    await start(root);
    const raw = JSON.parse(readFileSync(join(runDir(root, `${FEATURE}.1`), "run.json"), "utf8"));
    expect(Object.keys(raw).sort()).toEqual(["approvals", "createdAt", "escalations", "feature", "gates", "lanes", "limit", "needsDecision", "phase", "round", "run", "stage", "status"]);
  });
});

describe("fleet workers, caps and stalls", () => {
  const worker = (lane: string, tasks: string, assistant = "claude") => ({ "worker-start": lane, assistant, tasks });

  it("019:FR-004, 019:FR-027: starts workers up to the total cap, then refuses naming the cap", async () => {
    const root = make();
    await start(root);
    expect((await update(root, worker("lane-1-1", "T001", "claude"))).code).toBe(0);
    expect((await update(root, worker("lane-1-2", "T002", "codex"))).code).toBe(0);
    expect((await update(root, worker("lane-1-3", "T003", "opencode"))).code).toBe(0);
    const fourth = await update(root, worker("lane-1-4", "T003", "gemini"));
    expect(fourth.code).toBe(1);
    expect(fourth.err).toContain("no free slot");
    expect(readRun(root, `${FEATURE}.1`)!.lanes.map((l) => l.lane)).toEqual([`${FEATURE}.lane-1-1`, `${FEATURE}.lane-1-2`, `${FEATURE}.lane-1-3`]);
  });

  it("019:FR-027: at most two of one assistant type by default", async () => {
    const root = make();
    await start(root);
    await update(root, worker("lane-1-1", "T001"));
    await update(root, worker("lane-1-2", "T002"));
    const third = await update(root, worker("lane-1-3", "T003"));
    expect(third.code).toBe(1);
    expect(third.err).toContain("no free slot for claude");
  });

  it("019:FR-027: a finished worker frees its slot", async () => {
    const root = make({ fleet: { concurrency: { total: 1, perType: 1 } } });
    await start(root);
    await update(root, worker("lane-1-1", "T001"));
    expect((await update(root, worker("lane-1-2", "T002"))).code).toBe(1);
    expect((await update(root, { "worker-done": "lane-1-1" })).code).toBe(0);
    expect((await update(root, worker("lane-1-2", "T002"))).code).toBe(0);
    expect((await statusJson(root)).slots).toMatchObject({ running: 1, free: 0 });
  });

  it("019:FR-026: a lane with no report for the stall limit is shown stalled, with a restart action", async () => {
    const root = make();
    await start(root);
    await update(root, worker("lane-1-1", "T001"));
    const old = new Date(Date.now() - 40 * 60_000).toISOString();
    writeMarker(root, { feature: FEATURE, agent: "claude", phase: "implement", at: old, lane: `${FEATURE}.lane-1-1`, state: "working", run: `${FEATURE}.1` });
    const r = await fleet(root, ["status", "001"]);
    expect(r.out).toContain("stalled: restart it with ambykit fleet update");
    expect(r.out).toContain("restarts left 2");
    const lane = (await statusJson(root)).lanes[0];
    expect(lane).toMatchObject({ lane: "lane-1-1", stalled: true, restartsLeft: 2 });
  });

  it("019:FR-026: restarts are counted, and after the limit the lane is paused and a person is asked", async () => {
    const root = make();
    await start(root);
    await update(root, worker("lane-1-1", "T001"));
    expect((await update(root, { restart: "lane-1-1" })).out).toContain("restart 1 of 2");
    expect((await update(root, { restart: "lane-1-1" })).out).toContain("restart 2 of 2");
    expect(readRun(root, `${FEATURE}.1`)!.lanes[0]!.restarts).toBe(2);
    const third = await update(root, { restart: "lane-1-1" });
    expect(third.code).toBe(1);
    expect(third.err).toMatch(/only a person may|Ask a person/i);
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-1")?.action).toBe("pause");
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ status: "waiting-person", needsDecision: true });
  });

  it("019:FR-026: restartLimit comes from the fleet config", async () => {
    const root = make({ fleet: { restartLimit: 1 } });
    await start(root);
    await update(root, worker("lane-1-1", "T001"));
    expect((await update(root, { restart: "lane-1-1" })).code).toBe(0);
    expect((await update(root, { restart: "lane-1-1" })).code).toBe(1);
  });

  it("019:FR-004: a worker needs an assistant and task IDs; an unknown lane is refused", async () => {
    const root = make();
    await start(root);
    expect((await update(root, { "worker-start": "lane-1-1" })).code).toBe(1);
    expect((await update(root, { "worker-done": "lane-9-9" })).code).toBe(1);
  });
});

describe("fleet review rounds and decisions", () => {
  it("019:FR-012: --round prints retry below the limit and escalate at it, waiting for a person", async () => {
    const root = make();
    await start(root);
    expect((await update(root, { round: "1" })).out).toContain("round 1/3: retry");
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ round: 1, status: "active", needsDecision: false });
    expect((await update(root, { round: "2" })).out).toContain("retry");
    const last = await update(root, { round: "3" });
    expect(last.out).toContain("round 3/3: escalate");
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ round: 3, status: "waiting-person", needsDecision: true });
  });

  it("019:SC-003: a loop of failures always ends within the limit with a person's turn", async () => {
    const root = make({ fleet: { roundLimit: 2 } });
    await start(root);
    const actions: string[] = [];
    for (let round = 1; round <= 2; round += 1) actions.push((await update(root, { round: String(round) })).out.split(": ")[1]!);
    expect(actions).toEqual(["retry", "escalate"]);
  });

  it("019:FR-024: a decision is recorded in escalations[] and the run continues from it", async () => {
    const root = make();
    await start(root);
    await update(root, { round: "3" });
    const r = await update(root, { decision: "accept the open finding, move on" });
    expect(r.code).toBe(0);
    const rec = readRun(root, `${FEATURE}.1`)!;
    expect(rec).toMatchObject({ status: "active", needsDecision: false });
    expect(rec.escalations).toHaveLength(1);
    expect(rec.escalations[0]).toMatchObject({ decision: "accept the open finding, move on", phase: 1 });
  });

  it("019:FR-009: stage and phase updates reset the round for a new phase", async () => {
    const root = make();
    await start(root);
    await update(root, { round: "2" });
    await update(root, { stage: "architect" });
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ stage: "architect", round: 2 });
    await update(root, { phase: "2" });
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ phase: 2, stage: "working", round: 0 });
    expect((await update(root, { stage: "nope" })).code).toBe(1);
    expect((await update(root, { phase: "x" })).code).toBe(1);
  });

  it("019:SC-002: a run cannot be marked done while a phase's Verify has not passed", async () => {
    const root = make({}, { done: [1, 2, 3] });
    await start(root);
    const early = await update(root, { done: true });
    expect(early.code).toBe(1);
    expect(early.err).toContain("not finished");
    expect(readRun(root, `${FEATURE}.1`)!.status).not.toBe("done");
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replaceAll("**Verify:** run the checks", "**Verify:** run the checks ✓ passed"));
    expect((await update(root, { done: true })).code).toBe(0);
    expect(readRun(root, `${FEATURE}.1`)!.status).toBe("done");
  });

  it("019:FR-014: a done run no longer counts as unfinished", async () => {
    const root = make({}, { done: [1, 2, 3] });
    await start(root);
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replaceAll("**Verify:** run the checks", "**Verify:** run the checks ✓ passed"));
    await update(root, { done: true });
    expect((await fleet(root, ["status", "001"])).out).toContain("no unfinished run");
  });
});

describe("fleet pause, resume, stop and rebuild", () => {
  it("019:FR-016: pause writes a directive per lane through 025's writer and records the run as paused", async () => {
    const root = make();
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001" });
    await update(root, { "worker-start": "lane-1-2", assistant: "codex", tasks: "T002" });
    const r = await update(root, { pause: true });
    expect(r.out).toContain("the worker obeys at its next report");
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-1")?.action).toBe("pause");
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-2")?.action).toBe("pause");
    expect(readRun(root, `${FEATURE}.1`)!.status).toBe("paused");
    expect((await fleet(root, ["directive", "001", "lane-1-1"])).out.trim()).toBe("pause");
  });

  it("019:FR-016: a paused lane frees its slot, resume writes continue and the run is active again", async () => {
    const root = make({ fleet: { concurrency: { total: 1, perType: 1 } } });
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001" });
    await update(root, { pause: "lane-1-1" });
    expect((await statusJson(root)).slots).toMatchObject({ free: 1 });
    await update(root, { resume: true });
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-1")?.action).toBe("continue");
    expect(readRun(root, `${FEATURE}.1`)!.status).toBe("active");
    expect((await fleet(root, ["directive", "001", "1-1"])).out.trim()).toBe("continue");
  });

  it("019:FR-016: stop is written like pause and a named lane touches only that lane", async () => {
    const root = make();
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001" });
    await update(root, { "worker-start": "lane-1-2", assistant: "codex", tasks: "T002" });
    await update(root, { stop: "lane-1-2" });
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-2")?.action).toBe("stop");
    expect(readDirective(root, `${FEATURE}.1`, "lane-1-1")).toBeNull();
    expect(readRun(root, `${FEATURE}.1`)!.status).toBe("active");
    expect((await update(root, { pause: "lane-7-7" })).code).toBe(1);
  });

  it("019:FR-016: a lane or run that is missing means continue, never a stop", async () => {
    const root = make();
    expect((await fleet(root, ["directive", "001", "lane-1-1"])).out.trim()).toBe("continue");
    await start(root);
    expect((await fleet(root, ["directive", "001", "lane-1-1"])).out.trim()).toBe("continue");
  });

  it("019:FR-015: a missing run.json is reported and rebuilt from tasks.md, keeping every checked task", async () => {
    const root = make({}, { done: [1, 2] });
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replace("**Verify:** run the checks", "**Verify:** run the checks ✓ passed"));
    await start(root);
    rmSync(join(runDir(root, `${FEATURE}.1`), "run.json"));
    const before = readFileSync(tasksFile(root), "utf8");
    const status = await fleet(root, ["status", "001"]);
    expect(status.out).toContain("missing or corrupt state");
    const r = await fleet(root, ["status", "001"], { rebuild: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("2 checked task(s) kept");
    expect(readRun(root, `${FEATURE}.1`)).toMatchObject({ status: "active", phase: 2, stage: "working", round: 0 });
    expect(readFileSync(tasksFile(root), "utf8")).toBe(before);
  });

  it("019:FR-015: a corrupt run.json is rebuilt too, salvaging the lanes it still holds", async () => {
    const root = make({}, { done: [1] });
    await start(root);
    await update(root, { "worker-start": "lane-1-2", assistant: "claude", tasks: "T002" });
    const file = join(runDir(root, `${FEATURE}.1`), "run.json");
    const raw = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ ...raw, status: "exploded" }));
    expect(readRun(root, `${FEATURE}.1`)).toBeNull();
    const r = await fleet(root, ["status", "001"], { rebuild: true });
    expect(r.out).toContain(`rebuilt ${FEATURE}.1`);
    expect(readRun(root, `${FEATURE}.1`)!.lanes).toHaveLength(1);
  });

  it("019:FR-015: a healthy run is never overwritten by --rebuild", async () => {
    const root = make();
    await start(root);
    const r = await fleet(root, ["status", "001"], { rebuild: true, run: `${FEATURE}.1` });
    expect(r.code).toBe(1);
    expect(r.err).toContain("readable");
    expect((await fleet(root, ["status", "001"], { rebuild: true })).out).toContain("nothing to rebuild");
  });

  it("019:SC-001: stop, then a fresh process resumes the same run with the checked tasks untouched", async () => {
    const root = make();
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001,T002" });
    tickTask(root, "001", "T001");
    await update(root, { stop: true });
    const resumed = await fleet(root, ["status", "001"]);
    expect(resumed.out).toContain(`${FEATURE}.1  paused`);
    expect(resumed.out).toContain("phase 1 (working): T002 pending");
    expect((await start(root)).code).toBe(1); // resuming, not restarting, unless asked
  });
});

describe("fleet claims and notes", () => {
  it("019:FR-017: the second claimant is refused naming the owner; overlapping paths conflict", async () => {
    const root = make();
    await start(root);
    expect((await fleet(root, ["claim", "001", "T001", "src/a.ts"], { worker: "lane-1-1" })).code).toBe(0);
    const refused = await fleet(root, ["claim", "001", "T002", "src/a.ts"], { worker: "lane-1-2" });
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("held by lane-1-1");
    expect(refused.err).toContain("T001");
    const nested = await fleet(root, ["claim", "001", "T002", "src"], { worker: "lane-1-2" });
    expect(nested.code).toBe(1);
    expect(Object.keys(readClaims(root, `${FEATURE}.1`))).toEqual(["src/a.ts"]);
  });

  it("019:FR-017: checking a task off releases its claims, and release frees them by hand", async () => {
    const root = make();
    await start(root);
    await fleet(root, ["claim", "001", "T001", "src/a.ts"], { worker: "lane-1-1" });
    await fleet(root, ["claim", "001", "T002", "src/b.ts"], { worker: "lane-1-2" });
    expect(tickTask(root, "001", "T001")).toMatchObject({ ok: true });
    expect(Object.keys(readClaims(root, `${FEATURE}.1`))).toEqual(["src/b.ts"]);
    expect((await fleet(root, ["release", "001", "T002"])).out).toContain("released src/b.ts");
    expect(readClaims(root, `${FEATURE}.1`)).toEqual({});
    expect((await fleet(root, ["release", "001", "T002"])).out).toContain("held no claims");
  });

  it("019:FR-017: status warns about a checked task that still holds claims (edited by hand)", async () => {
    const root = make();
    await start(root);
    await fleet(root, ["claim", "001", "T001", "src/a.ts"], { worker: "lane-1-1" });
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replace("[ ] [T001]", "[x] [T001]"));
    const r = await fleet(root, ["status", "001"]);
    expect(r.out).toContain("warning: T001 is checked off but still claims src/a.ts");
    expect(r.out).toContain("ambykit fleet release");
  });

  it("019:FR-018: a note is one line T### | files | text, validated, and read back in order", async () => {
    const root = make();
    await start(root);
    const r = await fleet(root, ["note", "001", "T001", "export", "the", "helper"], { files: "src/a.ts,src/b.ts" });
    expect(r.code).toBe(0);
    expect(r.out).toBe("T001 | src/a.ts, src/b.ts | export the helper");
    await fleet(root, ["note", "001", "T002", "no files here"]);
    expect(readNotes(root, `${FEATURE}.1`)).toHaveLength(2);
    expect((await fleet(root, ["note", "001", "nope", "text"])).code).toBe(1);
    expect((await fleet(root, ["note", "001", "T001"])).code).toBe(1);
  });

  it("019:FR-018: claim, release and note without a run say so instead of inventing one", async () => {
    const root = make();
    for (const args of [["claim", "001", "T001", "src/a.ts"], ["release", "001", "T001"], ["note", "001", "T001", "hi"]]) {
      const r = await fleet(root, args);
      expect(r.code, args.join(" ")).toBe(1);
      expect(r.err).toContain("no unfinished run");
    }
    expect(listRuns(root, FEATURE)).toHaveLength(0);
  });

  it("019:FR-017: claims are advisory: a lane's edit with no claim is a status warning, not an error", async () => {
    const root = make();
    await start(root);
    const r = await fleet(root, ["status", "001"]);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/with no claim/); // no lane checkouts here: nothing to compare
  });
});

describe("fleet overlap decisions", () => {
  async function twoLanes(root: string) {
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001" });
    await update(root, { "worker-start": "lane-1-2", assistant: "codex", tasks: "T002" });
  }

  it("019:FR-019: serialize is recorded on both lanes, in a fixed order, before work", async () => {
    const root = make();
    await twoLanes(root);
    const r = await update(root, { overlap: "serialized", lanes: "lane-1-1,lane-1-2", order: "lane-1-2,lane-1-1" });
    expect(r.code).toBe(0);
    const lanes = readRun(root, `${FEATURE}.1`)!.lanes;
    expect(lanes[0]!.overlap).toEqual({ mode: "serialized", with: ["lane-1-2"], mergeOrder: ["lane-1-2", "lane-1-1"] });
    expect(lanes[1]!.overlap?.mergeOrder).toEqual(["lane-1-2", "lane-1-1"]);
  });

  it("019:FR-019: a squad records one writer per shared file and the merge order", async () => {
    const root = make();
    await twoLanes(root);
    const r = await update(root, { overlap: "squad", lanes: "lane-1-1,lane-1-2", shared: "src/x.ts,src/y.ts", writer: "src/x.ts:lane-1-1,src/y.ts:lane-1-2", order: "lane-1-1,lane-1-2" });
    expect(r.code).toBe(0);
    expect(readRun(root, `${FEATURE}.1`)!.lanes[0]!.overlap).toEqual({ mode: "squad", with: ["lane-1-2"], writers: { "src/x.ts": "lane-1-1", "src/y.ts": "lane-1-2" }, mergeOrder: ["lane-1-1", "lane-1-2"] });
  });

  it("019:FR-019: a squad without a writer for every shared file, or a bad mode, is refused and nothing is written", async () => {
    const root = make();
    await twoLanes(root);
    const before = JSON.stringify(readRun(root, `${FEATURE}.1`));
    expect((await update(root, { overlap: "squad", lanes: "lane-1-1,lane-1-2", shared: "src/x.ts", order: "lane-1-1,lane-1-2" })).code).toBe(1);
    expect((await update(root, { overlap: "gang", lanes: "lane-1-1,lane-1-2", order: "lane-1-1,lane-1-2" })).code).toBe(1);
    expect(JSON.stringify(readRun(root, `${FEATURE}.1`))).toBe(before);
  });
});

describe("fleet argument handling", () => {
  it("019:FR-013: unknown subcommands, missing and unknown features and empty updates are refused", async () => {
    const root = make();
    expect((await fleet(root, [])).code).toBe(1);
    expect((await fleet(root, ["frobnicate", "001"])).code).toBe(1);
    expect((await fleet(root, ["status"])).code).toBe(1);
    expect((await fleet(root, ["status", "999"])).err).toContain("not found");
    await start(root);
    expect((await update(root, {})).err).toContain("nothing to update");
  });

  it("019:FR-013: nothing outside .amby/fleet and tasks.md is written by the wrapper", async () => {
    const root = make();
    mkdirSync(join(root, "src"), { recursive: true });
    const spec = readFileSync(join(root, "specs", FEATURE, "spec.md"), "utf8");
    await start(root);
    await update(root, { "worker-start": "lane-1-1", assistant: "claude", tasks: "T001" });
    await fleet(root, ["status", "001"]);
    expect(readFileSync(join(root, "specs", FEATURE, "spec.md"), "utf8")).toBe(spec);
  });
});

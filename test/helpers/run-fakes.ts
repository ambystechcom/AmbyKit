import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RUNNERS, type RunnerSpec } from "../../src/core/runners.js";
import type { ExitInfo, ProcessHandle, ProcessPort, SpawnSpec } from "../../src/cli/run-process.js";
import { LaneCommand } from "../../src/cli/lane.js";
import { commitFile, laneProject, type LaneProject } from "./lane-fixture.js";
import { runCommand } from "./run-command.js";
import { phase, tasksMd, type TaskDef } from "./tasks-fixture.js";

/** Path of the scripted fake runner (spawned only by the process-edge test). */
export const FAKE_RUNNER = resolve(__dirname, "..", "fixtures", "fake-runner.mjs");

/** Verified registry entries that run the fake runner instead of a real assistant. */
export function fakeRegistry(ids: string[] = ["claude", "codex"], usage = false): RunnerSpec[] {
  return ids.map((id) => ({
    ...(RUNNERS[0] as RunnerSpec),
    id,
    label: id,
    verified: true,
    verifiedVersion: "fake",
    reportsUsage: usage,
    invoke: (job) => ({ exe: process.execPath, args: [FAKE_RUNNER], stdin: job.prompt }),
  }));
}

export interface FakeHandle extends ProcessHandle {
  spec: SpawnSpec;
  /** Finish the process as if it exited. */
  finish(code?: number | null, signal?: string | null): void;
  killed: string[];
}

/** An in-memory process port: nothing is spawned, tests decide when and how each process ends. */
export class FakePort implements ProcessPort {
  starts: FakeHandle[] = [];
  /** Called on each spawn so a test can script what the "assistant" does (tick tasks, write markers). */
  onSpawn?: (h: FakeHandle) => void;
  private nextPid = 1000;
  private readonly live = new Set<number>();

  spawn(spec: SpawnSpec): ProcessHandle {
    let resolveExit!: (e: ExitInfo) => void;
    const exited = new Promise<ExitInfo>((r) => (resolveExit = r));
    const pid = this.nextPid++;
    this.live.add(pid);
    let done = false;
    const handle: FakeHandle = {
      spec,
      pid,
      killed: [],
      exited,
      alive: () => !done,
      kill: (signal = "SIGTERM") => {
        handle.killed.push(signal);
        handle.finish(null, signal);
      },
      finish: (code = 0, signal = null) => {
        if (done) return;
        done = true;
        this.live.delete(pid);
        resolveExit({ code, signal });
      },
    };
    this.starts.push(handle);
    this.onSpawn?.(handle);
    return handle;
  }
  isAlive(pid: number): boolean {
    return this.live.has(pid);
  }
  kill(pid: number): void {
    const h = this.starts.find((s) => s.pid === pid);
    h?.finish(null, "SIGTERM");
  }
}

/** A project with prepared lanes: `n` parallel tasks in phase 1, split into lanes by `ambykit lane`. */
export async function preparedProject(feature: string, tasks = 4, lanes = 2, extra: string[] = []): Promise<LaneProject> {
  const defs: TaskDef[] = Array.from({ length: tasks }, (_, i) => ({ id: `T00${i + 1}`, parallel: true, paths: [`src/f${i + 1}.ts`] }));
  const p = laneProject(feature, tasksMd([phase(1, defs)], { feature }));
  const r = await runCommand(new LaneCommand(), p.root, [feature], { lanes: String(lanes), ...Object.fromEntries(extra.map((e) => [e, true])) });
  if (r.code !== 0) throw new Error(`could not prepare lanes: ${r.err}`);
  return p;
}

/** Tick `ids` in a lane checkout's tasks.md (what a worker does). */
export function tickIn(laneRoot: string, feature: string, ids: string[]): void {
  const file = join(laneRoot, "specs", feature, "tasks.md");
  let text = readFileSync(file, "utf8");
  for (const id of ids) text = text.replace(`- [ ] [${id}]`, `- [x] [${id}]`);
  writeFileSync(file, text);
}

// --- supervisor harness (feature 028) ----------------------------------------------------------

import { mkdirSync } from "node:fs";
import { bootstrapRun, readLaneFile, writeLaneFile, type LaneFile } from "../../src/cli/run-files.js";
import { Supervisor } from "../../src/cli/run-loop.js";
import { preparedLanes } from "../../src/cli/run.js";
import type { LaneRuntime, Session } from "../../src/cli/run-session.js";
import { fleetSettings, loadConfig, type FleetSettings } from "../../src/core/config.js";
import { resolveBudgets, type Budgets } from "../../src/core/run-supervise.js";
import { primaryRoot } from "../../src/core/checkouts.js";

export interface Harness {
  s: Session;
  sup: Supervisor;
  port: FakePort;
  clock: { t: number };
  said: string[];
  run: string;
  /** Let promise callbacks (process exits) run, then tick once. */
  step(): Promise<unknown>;
  advance(minutes: number): void;
  lane(short: string): LaneRuntime;
}

export interface HarnessOptions {
  assistants?: string[];
  review?: boolean;
  settings?: Partial<FleetSettings>;
  budgets?: Partial<Budgets>;
  usage?: boolean;
  unattended?: boolean;
}

export const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

/** A session over a prepared project: real git lanes and files, fake processes and a fake clock. */
export function harness(p: LaneProject, opts: HarnessOptions = {}): Harness {
  const root = p.root;
  const feature = p.feature;
  const assistants = opts.assistants ?? ["claude", "codex"];
  const lanes = preparedLanes(root, feature);
  const base = fleetSettings(loadConfig(primaryRoot(root)));
  const settings: FleetSettings = { ...base, ...(opts.settings ?? {}) };
  const boot = bootstrapRun(
    root,
    feature,
    lanes.map((l, i) => ({ lane: l.name, assistant: assistants[i % assistants.length]!, tasks: l.manifest.tasks.map((t) => t.id) })),
    () => false,
    Math.min(...lanes.map((l) => l.manifest.phase)),
  );
  if (!boot.ok) throw new Error(boot.warning);
  const run = boot.run.run;
  const clock = { t: Date.now() };
  const port = new FakePort();
  const said: string[] = [];
  const runtimes: LaneRuntime[] = lanes.map((ref, i) => {
    const assistant = assistants[i % assistants.length]!;
    const file: LaneFile = { lane: ref.short, full: ref.name, assistant, status: "queued", restarts: 0 };
    writeLaneFile(root, run, file);
    return { ref, assistant, file, job: "worker", round: 1 };
  });
  const s: Session = {
    root,
    feature,
    run,
    settings,
    budgets: { ...resolveBudgets({ openTasks: 8 }), ...(opts.budgets ?? {}) },
    registry: fakeRegistry(["claude", "codex", ...assistants]),
    port,
    now: () => clock.t,
    say: (l) => void said.push(l),
    lanes: runtimes,
    unattended: opts.unattended ?? false,
    reportsUsage: opts.usage ?? false,
  };
  const sup = new Supervisor(s, opts.review ?? false);
  return {
    s,
    sup,
    port,
    clock,
    said,
    run,
    step: async () => {
      await flush();
      return sup.tick();
    },
    advance: (m) => void (clock.t += m * 60_000),
    lane: (short) => runtimes.find((r) => r.file.lane === short)!,
  };
}

/** What a scripted worker or reviewer does the moment its process starts. */
export interface Script {
  /** Tick the lane's tasks and exit cleanly (default true). */
  work?: boolean;
  exit?: number;
  /** The workers never end by themselves (a hung process). */
  hang?: boolean;
  /** Reviewer verdict: pass, fail with these finding ids, or write nothing. */
  verdict?: "pass" | "none" | string[];
}

const IDS = /check each off in tasks\.md: ([T0-9, ]+)\./;
const VERDICT = /Write your verdict to (\S+) as JSON/;

/** Script every spawned process: a worker ticks its tasks, a reviewer writes its verdict file. */
export function script(h: Pick<Harness, "port">, p: LaneProject, how: Script | ((cwd: string, prompt: string) => Script) = {}): void {
  h.port.onSpawn = (proc) => {
    const prompt = proc.spec.stdin ?? "";
    const plan = typeof how === "function" ? how(proc.spec.cwd, prompt) : how;
    const review = VERDICT.exec(prompt);
    if (review) {
      const v = plan.verdict ?? "pass";
      if (v !== "none") {
        const file = join(primaryRoot(p.root), review[1]!);
        mkdirSync(join(file, ".."), { recursive: true });
        writeFileSync(
          file,
          JSON.stringify(v === "pass" ? { verdict: "pass", findings: [] } : { verdict: "fail", findings: v.map((id) => ({ id, severity: "high", finding: `${id} is wrong`, fix: "fix it" })) }),
        );
      }
      proc.finish(plan.exit ?? 0);
      return;
    }
    const m = IDS.exec(prompt);
    if (plan.work !== false && m) {
      tickIn(proc.spec.cwd, p.feature, m[1]!.split(",").map((x) => x.trim()));
      commitFile(proc.spec.cwd, `src/${proc.spec.cwd.split(/[\\/]/).pop()}.ts`, "work\n", "worker commit");
    }
    if (!plan.hang) proc.finish(plan.exit ?? 0);
  };
}

export { readLaneFile };

/** One phase of a multi-phase project: `tasks` parallel tasks tagged with `story`, plus `stays` non-parallel ones. */
export interface PhasePlan {
  story?: number;
  tasks: number;
  lanes?: number;
  stays?: number;
}

/** A project with prepared lanes for several phases (one `ambykit lane --phase=N` per phase). */
export async function phasedProject(feature: string, phases: PhasePlan[]): Promise<LaneProject> {
  let n = 0;
  const defs = phases.map((ph, i) => {
    const tasks: TaskDef[] = [];
    for (let k = 0; k < ph.tasks; k++) {
      n += 1;
      tasks.push({ id: `T${String(n).padStart(3, "0")}`, parallel: true, ...(ph.story ? { story: ph.story } : {}), paths: [`src/p${i + 1}f${k + 1}.ts`] });
    }
    for (let k = 0; k < (ph.stays ?? 0); k++) {
      n += 1;
      tasks.push({ id: `T${String(n).padStart(3, "0")}`, ...(ph.story ? { story: ph.story } : {}), paths: [`src/stay${i + 1}${k + 1}.ts`] });
    }
    return phase(i + 1, tasks);
  });
  const p = laneProject(feature, tasksMd(defs, { feature }));
  for (const [i, ph] of phases.entries()) {
    const r = await runCommand(new LaneCommand(), p.root, [feature], { phase: String(i + 1), lanes: String(ph.lanes ?? 1) });
    if (r.code !== 0) throw new Error(`could not prepare phase ${i + 1}: ${r.err}`);
  }
  return p;
}

/** Merge `patch` into `.amby/config.json` (before a run is created, so the run record picks it up). */
export function configure(root: string, patch: Record<string, unknown>): void {
  const file = join(root, ".amby", "config.json");
  const cfg = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  writeFileSync(file, JSON.stringify({ ...cfg, ...patch }) + "\n");
}

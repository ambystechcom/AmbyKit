import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RUNNERS, type RunnerSpec } from "../../src/core/runners.js";
import type { ExitInfo, ProcessHandle, ProcessPort, SpawnSpec } from "../../src/cli/run-process.js";
import { LaneCommand } from "../../src/cli/lane.js";
import { laneProject, type LaneProject } from "./lane-fixture.js";
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

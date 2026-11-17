import { runnable } from "../core/runners.js";
import { nextToStart } from "../core/run-schedule.js";
import { lanePromptText, laneOpenTasks } from "./run-plan.js";
import { writePromptFile } from "./run-files.js";
import { rolePromptText } from "./run-protocol-prompts.js";
import { event, isRunning, save, type JobKind, type LaneRuntime, type Session } from "./run-session.js";

/**
 * The launch queue (feature 028, FR-004, FR-005): one process per lane, in the lane's own worktree, started
 * only while a slot is free under `fleet.concurrency`. A lane that cannot start (no verified runner, spawn
 * failure) is marked `failed` with the reason, never silently skipped.
 */

/** Lanes whose process is running now: the occupants of the concurrency slots. */
export function running(s: Session): LaneRuntime[] {
  return s.lanes.filter((l) => isRunning(s, l));
}

/** Start one process for a lane: its worker, or a review job. Returns false when it could not start. */
export function startJob(s: Session, rt: LaneRuntime, job: JobKind, opts: { findings?: string[]; restart?: boolean } = {}): boolean {
  const can = runnable(rt.assistant, s.registry);
  if (!can.ok) {
    rt.file.status = "failed";
    rt.file.reason = can.reason;
    save(s, rt);
    event(s, "refused", rt, can.reason);
    s.say(`${rt.file.lane}: not started — ${can.reason}`);
    return false;
  }
  const prompt =
    job === "worker"
      ? lanePromptText(rt.ref, s.run, laneOpenTasks(rt.ref), opts.findings)
      : rolePromptText(s, rt, job);
  const file = writePromptFile(s.root, s.run, job === "worker" ? rt.file.lane : `${rt.file.lane}.${job}.${rt.round}`, prompt);
  const command = can.runner.invoke({ prompt, promptFile: file, ...(s.settings.workerModel ? { model: s.settings.workerModel } : {}) });
  try {
    rt.handle = s.port.spawn({ exe: command.exe, args: command.args, cwd: rt.ref.root, ...(command.stdin !== undefined ? { stdin: command.stdin } : {}) });
  } catch (err) {
    rt.file.status = "failed";
    rt.file.reason = `could not start ${rt.assistant}: ${(err as Error).message}`;
    save(s, rt);
    event(s, "spawn-failed", rt, rt.file.reason);
    return false;
  }
  rt.job = job;
  rt.startedMs = s.now();
  delete rt.exit;
  delete rt.exitedMs;
  rt.file.status = job === "worker" ? "running" : "reviewing";
  rt.file.assistant = rt.assistant;
  if (rt.handle.pid !== undefined) rt.file.pid = rt.handle.pid;
  else delete rt.file.pid;
  rt.file.startedAt = new Date(s.now()).toISOString();
  delete rt.file.reason;
  save(s, rt);
  const handle = rt.handle;
  void handle.exited.then((info) => {
    if (rt.handle !== handle) return; // a newer process replaced it
    rt.exit = info;
    rt.exitedMs = s.now();
  });
  event(s, opts.restart ? "restarted" : "started", rt, `${rt.assistant} ${job}${handle.pid !== undefined ? ` pid ${handle.pid}` : ""}`);
  s.say(`${rt.file.lane}: ${opts.restart ? "restarted" : "started"} on ${rt.assistant}${job === "worker" ? "" : ` (${job} review)`}`);
  return true;
}

/** Lanes queued to start, in phase then lane order. `phase` limits the set (a later set waits for the gate). */
export function queued(s: Session, phase: number): LaneRuntime[] {
  return s.lanes.filter((l) => l.file.status === "queued" && l.ref.manifest.phase === phase);
}

/** Start queued lanes of the current phase while slots are free (FR-005). No-op once a budget stop is in force. */
export function launchQueued(s: Session, phase: number): number {
  if (s.stopReason) return 0;
  const queue = queued(s, phase);
  if (queue.length === 0) return 0;
  const toStart = nextToStart(
    queue.map((l) => ({ lane: l.file.lane, assistant: l.assistant })),
    running(s).map((l) => ({ lane: l.file.lane, assistant: l.assistant })),
    s.settings.concurrency,
  );
  let n = 0;
  for (const t of toStart) {
    const rt = s.lanes.find((l) => l.file.lane === t.lane)!;
    if (startJob(s, rt, "worker", rt.pendingFindings ? { findings: rt.pendingFindings } : {})) n += 1;
    delete rt.pendingFindings;
  }
  return n;
}

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  UNFINISHED,
  createRun,
  damagedRuns,
  listRuns,
  readRun,
  rebuildFromTasks,
  restoreRun,
  runDir,
  writeFileAtomic,
  readFlowInput,
  type RunLane,
  type RunRecord,
  type RunResult,
} from "../core/fleet/index.js";
import { primaryRoot } from "../core/checkouts.js";
import { loadConfig, fleetSettings } from "../core/config.js";

/**
 * 028's own supervision files, kept inside spec 025's run directory (`.amby/fleet/<run>/`) and written through
 * 025's atomic writer: `lanes/<lane>.json`, `events.jsonl`, `prompts/<lane>.md`, `budget.json` and `run.lock`.
 * Run creation, `run.json` and everything else about run state is 025's (`createRun`, `updateRun`, ...); this
 * file keeps no run-id or state logic of its own (FR-017, FR-020: nothing leaves the project).
 */

export type LaneRunStatus =
  | "queued"
  | "running"
  | "finished" // process exited and every task is checked
  | "reviewing"
  | "merged"
  | "paused" // restart limit reached, or a person paused it
  | "failed" // exited at once with an error (a version mismatch)
  | "unfinished" // exited with tasks still open; never merged
  | "stopped"
  | "conflict" // merge conflict, waiting for a person
  | "ready" // reviews passed; waiting to merge
  | "escalated"; // the review loop ended without agreement; a person decides

export interface LaneFile {
  /** Short lane name `lane-p-k`. */
  lane: string;
  /** Full lane name `NNN-slug.lane-p-k`. */
  full: string;
  assistant: string;
  status: LaneRunStatus;
  restarts: number;
  pid?: number;
  startedAt?: string;
  exitedAt?: string;
  exit?: { code: number | null; signal: string | null };
  reason?: string;
  /** When the lane was paused, so a later `continue` directive can be told from an earlier one. */
  pausedAt?: string;
  /** Review rounds that failed so far (the loop's counter). */
  failedRounds?: number;
}

const read = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

const write = (file: string, data: unknown): void => writeFileAtomic(file, JSON.stringify(data, null, 2) + "\n");

export const lanesDir = (root: string, run: string): string => join(runDir(root, run), "lanes");

export function readLaneFile(root: string, run: string, lane: string): LaneFile | null {
  return read<LaneFile>(join(lanesDir(root, run), `${lane}.json`));
}

export function writeLaneFile(root: string, run: string, file: LaneFile): void {
  write(join(lanesDir(root, run), `${file.lane}.json`), file);
}

export function listLaneFiles(root: string, run: string): LaneFile[] {
  const dir = lanesDir(root, run);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .map((n) => read<LaneFile>(join(dir, n)))
    .filter((f): f is LaneFile => f !== null)
    .sort((a, b) => a.lane.localeCompare(b.lane));
}

export interface RunEvent {
  at: string;
  kind: string;
  lane?: string;
  detail?: string;
}

/** Append-only audit trail (`events.jsonl`): every start, restart, merge, gate and obeyed directive. */
export function appendEvent(root: string, run: string, event: Omit<RunEvent, "at"> & { at?: string }): void {
  const file = join(runDir(root, run), "events.jsonl");
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify({ at: event.at ?? new Date().toISOString(), kind: event.kind, ...(event.lane ? { lane: event.lane } : {}), ...(event.detail ? { detail: event.detail } : {}) }) + "\n");
}

export function readEvents(root: string, run: string): RunEvent[] {
  try {
    return readFileSync(join(runDir(root, run), "events.jsonl"), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l) as RunEvent);
  } catch {
    return [];
  }
}

/** The prompt a lane was started with, kept as a file so a person can read what the assistant was told. */
export function writePromptFile(root: string, run: string, name: string, text: string): string {
  const file = join(runDir(root, run), "prompts", `${name}.md`);
  writeFileAtomic(file, text.endsWith("\n") ? text : `${text}\n`);
  return file;
}

// --- budget meter -----------------------------------------------------------------

export interface BudgetFile {
  /** Wall-clock time the run has been supervised, across continued sessions. */
  elapsedMs: number;
  /** Task events used: check-offs seen, plus restarts and fix rounds. */
  tasksUsed: number;
  /** Tokens used, only for runners that report usage (input plus output tokens from each process's result). */
  tokensUsed?: number;
  /** Check-offs already counted, so a continued run does not count them twice. */
  counted: string[];
}

export function readBudget(root: string, run: string): BudgetFile {
  return read<BudgetFile>(join(runDir(root, run), "budget.json")) ?? { elapsedMs: 0, tasksUsed: 0, counted: [] };
}

export function writeBudget(root: string, run: string, b: BudgetFile): void {
  write(join(runDir(root, run), "budget.json"), b);
}

// --- run lock and active-run guard (US-2, T051) ---------------------------------------

export interface RunLock {
  pid: number;
  at: string;
}

export const lockFile = (root: string, run: string): string => join(runDir(root, run), "run.lock");

export function readRunLock(root: string, run: string): RunLock | null {
  return read<RunLock>(lockFile(root, run));
}

export type LockResult = { ok: true } | { ok: false; reason: string };

/** One supervisor per run: refuse while the pid in `run.lock` is alive; a dead pid's lock is taken over. */
export function acquireRunLock(root: string, run: string, pid: number, isAlive: (pid: number) => boolean, now = new Date()): LockResult {
  const held = readRunLock(root, run);
  if (held && held.pid !== pid && isAlive(held.pid)) {
    return { ok: false, reason: `run ${run} is already supervised by process ${held.pid}` };
  }
  write(lockFile(root, run), { pid, at: now.toISOString() } satisfies RunLock);
  return { ok: true };
}

export function releaseRunLock(root: string, run: string, pid: number): void {
  const held = readRunLock(root, run);
  if (held && held.pid === pid) rmSync(lockFile(root, run), { force: true });
}

/**
 * A feature may have one live run at a time (FR-017, US-2 AC): a second `ambykit run` on the same feature
 * refuses while an unfinished run exists. A run whose supervisor died is not restarted by a new run; the
 * message points at `--continue-run`.
 */
export function guardNewRun(root: string, feature: string, isAlive: (pid: number) => boolean): LockResult {
  for (const r of listRuns(root, feature)) {
    if (!UNFINISHED.includes(r.status)) continue;
    const lock = readRunLock(root, r.run);
    if (lock && isAlive(lock.pid)) return { ok: false, reason: `${feature} already has run ${r.run} in progress (process ${lock.pid}); wait for it or stop it first` };
    return { ok: false, reason: `${feature} has an unfinished run ${r.run}; continue it with --continue-run=${r.run}` };
  }
  return { ok: true };
}

// --- bootstrap (T010) -----------------------------------------------------------------

/** Create `<feature>.<n>` on explicit request through 025's store, with the lanes of the prepared sets. */
export function bootstrapRun(
  root: string,
  feature: string,
  lanes: RunLane[],
  isAlive: (pid: number) => boolean,
  phase = 0,
): RunResult | { ok: false; warning: string } {
  const guard = guardNewRun(root, feature, isAlive);
  if (!guard.ok) return { ok: false, warning: guard.reason };
  return createRun(root, feature, { lanes, phase });
}

/**
 * Open an existing run to continue it (`--continue-run`). A run whose `run.json` is missing or corrupt is
 * rebuilt from `tasks.md` through 025's `rebuildFromTasks`; checked tasks stay checked (FR-017).
 */
export function openRun(root: string, run: string): { ok: true; record: RunRecord; rebuilt: boolean } | { ok: false; reason: string } {
  const primary = primaryRoot(root);
  const have = readRun(root, run);
  if (have) return { ok: true, record: have, rebuilt: false };
  const feature = run.slice(0, run.lastIndexOf("."));
  if (!damagedRuns(root, feature).includes(run)) return { ok: false, reason: `run '${run}' not found` };
  const settings = fleetSettings(loadConfig(primary));
  const record = rebuildFromTasks(readFlowInput(root, feature), { run, feature, limit: settings.roundLimit });
  const restored = restoreRun(root, record);
  return restored.ok ? { ok: true, record: restored.run, rebuilt: true } : { ok: false, reason: restored.warning };
}


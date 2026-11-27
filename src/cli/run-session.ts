import type { FleetSettings } from "../core/config.js";
import type { LaneRef } from "../core/query.js";
import type { RunnerSpec } from "../core/runners.js";
import type { Budgets } from "../core/run-supervise.js";
import { appendEvent, writeLaneFile, type LaneFile } from "./run-files.js";
import type { ExitInfo, ProcessHandle, ProcessPort } from "./run-process.js";

/**
 * The state one supervisor process keeps while it runs a feature (feature 028). Everything durable is in
 * `.amby/fleet/<run>/` (spec 025's `run.json` plus 028's lane files, events and budget meter); this object
 * holds only what cannot be: live process handles and clocks. Modules take a `Session` and a lane runtime, so
 * each concern (launch, supervise, merge, budget, gates, control, protocol) stays independently testable.
 */

export type JobKind = "worker" | "qa" | "architect";

export interface LaneRuntime {
  ref: LaneRef;
  assistant: string;
  file: LaneFile;
  /** What the current (or last) process is doing. */
  job: JobKind;
  /** Review round the lane is in (1-based), once its tasks are done. */
  round: number;
  /** Set once the lane's tasks are done and the review loop has begun. */
  stage?: "qa" | "architect";
  handle?: ProcessHandle;
  startedMs?: number;
  exit?: ExitInfo;
  exitedMs?: number;
  /** When a stop was asked for (budget or person), for the stop grace. */
  stopAskedMs?: number;
  /** Review finding IDs to send back to the worker at its next start. */
  pendingFindings?: string[];
  /** The directive `at` last recorded as obeyed, so it is recorded once. */
  obeyedAt?: string;
}

export interface Session {
  root: string;
  feature: string;
  run: string;
  settings: FleetSettings;
  budgets: Budgets;
  registry: RunnerSpec[];
  port: ProcessPort;
  now: () => number;
  /** Human-readable progress line. */
  say: (line: string) => void;
  lanes: LaneRuntime[];
  unattended: boolean;
  /** Set when a budget stop is in force: nothing new launches. */
  stopReason?: string;
  /** True when every runner of the run reports usage (token ceilings are enforceable). */
  reportsUsage: boolean;
  /** Prompts for a decision in the foreground (TTY), when one is available. */
  ask?: (question: string) => Promise<boolean | undefined>;
  /**
   * Feature 031: the lanes running in the OTHER sessions of the same fleet. They count toward the total and
   * per-type caps, so the caps hold across the fleet. Absent (a single run) means today's behavior exactly.
   */
  slots?: () => { lane: string; assistant: string }[];
  /**
   * Prepare the feature's next stage once every lane has merged (the 2.0 dogfood: sequential tasks must run too). The
   * supervisor adds the returned lanes and keeps going; `none` = every task is done. Absent = the 1.6 behaviour: the run
   * ends when its prepared lanes have merged.
   */
  prepareNext?: (merged: ReadonlySet<string>) => NextStage;
}

export type NextStage =
  | { kind: "none" }
  | { kind: "planned"; phase: number; stage: "serial" | "parallel"; lanes: { ref: LaneRef; assistant: string }[] }
  | { kind: "failed"; reason: string };

/** Persist a lane's file after changing it. */
export function save(s: Session, rt: LaneRuntime): void {
  writeLaneFile(s.root, s.run, rt.file);
}

export function event(s: Session, kind: string, rt?: LaneRuntime, detail?: string): void {
  appendEvent(s.root, s.run, { at: new Date(s.now()).toISOString(), kind, ...(rt ? { lane: rt.file.lane } : {}), ...(detail ? { detail } : {}) });
}

/** Whether a lane's process is running now (this session's handle, or a pid from an earlier session). */
export function isRunning(s: Session, rt: LaneRuntime): boolean {
  if (rt.handle) return rt.handle.alive();
  return rt.file.pid !== undefined && rt.file.status === "running" && s.port.isAlive(rt.file.pid);
}

export function stopProcess(s: Session, rt: LaneRuntime, signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): void {
  if (rt.handle) rt.handle.kill(signal);
  else if (rt.file.pid !== undefined) s.port.kill(rt.file.pid, signal);
}

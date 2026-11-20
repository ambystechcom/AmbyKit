import { primaryRoot } from "../core/checkouts.js";
import { fleetSettings, loadConfig, type FleetSettings } from "../core/config.js";
import { createFleet, createRun, readFleetRecord, readRun, updateFleet, updateRun, type RunLane } from "../core/fleet/index.js";
import { errorLines, planJson, planLines } from "../core/fleet-plan/format.js";
import { buildFleetPlan } from "../core/fleet-plan/plan.js";
import { readFleetInput } from "../core/fleet-plan/read.js";
import { resolveFeature, selectFeatures } from "../core/fleet-plan/select.js";
import type { FleetBudgets, FleetFeature, FleetPlan, FleetRecord } from "../core/fleet-plan/types.js";
import { assignAssistants } from "../core/run-launch-plan.js";
import { laneRefs, type LaneRef } from "../core/query.js";
import { runnable } from "../core/runners.js";
import { resolveBudgets } from "../core/run-supervise.js";
import { flag, stringFlag, type CliOptions } from "./base-command.js";
import { beginStop } from "./run-budget.js";
import { reviveForContinue } from "./run-control.js";
import { acquireRunLock, guardNewRun, readBudget, readLaneFile, releaseRunLock, writeLaneFile, type LaneFile } from "./run-files.js";
import { FleetSupervisor, superviseFleet, type BeginResult, type FeatureRun, type FleetOutcome } from "./run-fleet-loop.js";
import { mergeDependencies, syncLanesWithFeature } from "./run-fleet-merge.js";
import { prepareLanes } from "./run-fleet-prepare.js";
import { running as runningLanes } from "./run-launch.js";
import { Supervisor } from "./run-loop.js";
import type { LaneRuntime, Session } from "./run-session.js";
import type { RunDeps } from "./run.js";

/**
 * `ambykit run <f1> <f2> ...`, `--all-ready`, `--continue-fleet=<id>` (feature 031). A fleet is one `Session` per
 * feature (028's, unchanged: its own run, lanes, gates and merge) driven by one `FleetSupervisor`. This file is the
 * edge: it reads the project through spec 030's reader (`readFleetInput`), shows the plan, and wires the real
 * sessions, lane preparation and dependency merges behind the loop's interfaces. Experimental, like `run` itself.
 */

export interface FleetIo {
  info(m: string): void;
  warn(m: string): void;
  error(m: string, hint?: string): void;
  success(m: string): void;
}

export type FleetDeps = RunDeps;

const WAITING_FOR_PERSON = new Set(["paused", "conflict", "escalated"]);

/** One feature's session and supervisor behind the loop's `FeatureRun` interface. */
class SessionRun implements FeatureRun {
  constructor(
    readonly feature: string,
    readonly run: string,
    private readonly s: Session,
    private readonly sup: Supervisor,
    private readonly release: () => void,
  ) {}
  tick() {
    return this.sup.tick();
  }
  runningLanes() {
    return runningLanes(this.s).map((l) => ({ lane: l.file.lane, assistant: l.assistant }));
  }
  needsPerson(): string | null {
    const l = this.s.lanes.find((x) => WAITING_FOR_PERSON.has(x.file.status));
    return l ? `${l.file.lane} ${l.file.status}${l.file.reason ? ` (${l.file.reason})` : ""}` : null;
  }
  meter() {
    const b = readBudget(this.s.root, this.run);
    return { elapsedMs: b.elapsedMs, tasksUsed: b.tasksUsed, ...(b.tokensUsed !== undefined ? { tokensUsed: b.tokensUsed } : {}) };
  }
  stop(reason: string): void {
    beginStop(this.s, reason);
  }
  interrupt() {
    return this.sup.interrupt();
  }
  end(): void {
    this.release();
  }
}

export const flagList = (opts: CliOptions, name: string): string[] => (stringFlag(opts, name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function budgetFlags(opts: CliOptions): Partial<FleetBudgets> {
  const n = (name: string): number | undefined => {
    const v = stringFlag(opts, name);
    const x = v === undefined ? NaN : Number(v);
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const out: Partial<FleetBudgets> = {};
  const m = n("max-minutes");
  const t = n("max-tasks");
  const k = n("max-tokens");
  if (m !== undefined) out.wallClockMinutes = m;
  if (t !== undefined) out.maxTasks = t;
  if (k !== undefined) out.maxTokens = k;
  return out;
}

/** The assistants lanes are spread over: `--assistant`, else `fleet.runners`, else the configured tools. */
function assistantsOf(root: string, opts: CliOptions): string[] {
  const flagged = flagList(opts, "assistant");
  if (flagged.length > 0) return flagged;
  const config = loadConfig(primaryRoot(root));
  const settings = fleetSettings(config);
  return settings.runners.length > 0 ? settings.runners : config.tools;
}

export type FleetEntry = number | { single: string };

export async function runFleet(root: string, args: string[], opts: CliOptions, deps: FleetDeps, io: FleetIo): Promise<FleetEntry> {
  const json = flag(opts, "json");
  const settings = fleetSettings(loadConfig(primaryRoot(root)));
  const cont = stringFlag(opts, "continue-fleet");
  const input = readFleetInput(root);

  // --- plan (or re-plan on resume) -------------------------------------------------------
  let existing: FleetRecord | null = null;
  let names = args;
  if (cont) {
    existing = readFleetRecord(root, cont);
    if (!existing) {
      io.error(`Fleet '${cont}' not found.`, "List fleets with: ambykit fleet --json");
      return 1;
    }
    // a resumed fleet re-plans over what is not finished; features that finished since are done dependencies
    names = existing.features.filter((f) => f.state !== "done" && f.state !== "skipped").map((f) => f.feature);
    if (names.length === 0) {
      io.success(`Fleet ${cont} has nothing left to run.`);
      return 0;
    }
  }
  const allReady = flag(opts, "all-ready") && !cont;
  if (!cont && !allReady) {
    // one distinct feature, however it is named or repeated, is a single run: unchanged, with no fleet readiness rules (FR-003, FR-019)
    const found = args.map((a) => resolveFeature(a, input.models));
    const distinct = new Set(found.filter((m) => m !== undefined).map((m) => m!.dir));
    if (distinct.size === 1 && found.every((m) => m !== undefined)) return { single: [...distinct][0]! };
  }
  const picked = selectFeatures(names, input.models, { ...(allReady ? { allReady: true } : {}) });
  const openTasks = picked.selected.reduce((n, m) => n + m.tasks.filter((t) => !t.done).length, 0);
  const budgets: FleetBudgets = existing?.budgets ?? { ...resolveBudgets({ openTasks, config: settings.budgets, flags: budgetFlags(opts) }) };
  const planned = buildFleetPlan({
    args: names,
    ...(allReady ? { allReady: true } : {}),
    models: input.models,
    deps: input.deps,
    // the fleet's own finished features are done dependencies: their work is on their branches, not on main's task lists
    done: new Set([...[...input.done].filter((d) => !names.includes(d)), ...(existing?.features.filter((f) => f.state === "done" || f.state === "skipped").map((f) => f.feature) ?? [])]),
    caps: existing?.caps ?? settings.concurrency,
    budgets,
  });
  if (!planned.ok) {
    for (const line of errorLines(planned.errors)) io.error(line);
    io.error("Nothing was started.");
    return 1;
  }
  const plan: FleetPlan = planned.value;
  const assistants = assistantsOf(root, opts);
  const reportsUsage = assistants.length > 0 && assistants.every((a) => deps.registry.find((r) => r.id === a)?.reportsUsage === true);
  // a token ceiling is only enforceable where every runner reports usage (028's rule); say so up front (FR-011)
  const ceilingNote = plan.budgets.maxTokens !== undefined && !reportsUsage ? "Token ceiling: not enforceable for this fleet (a runner does not report usage); the wall-clock and task budgets still apply." : undefined;

  if (!cont) {
    if (!allReady && plan.features.length === 1) return { single: plan.features[0]!.feature };
    if (json) console.log(JSON.stringify({ ...(planJson(plan) as object), launched: false, launching: flag(opts, "yes"), ...(plan.budgets.maxTokens !== undefined ? { tokenCeilingEnforced: ceilingNote === undefined } : {}) }));
    else {
      for (const line of planLines(plan)) io.info(line);
      if (ceilingNote) io.info(ceilingNote);
    }
    if (!(flag(opts, "yes") || flag(opts, "y"))) {
      if (!json) io.info("Nothing launched. Re-run with --yes to start this fleet.");
      return 0;
    }
  }

  // --- refuse unverified runners before anything starts (028 FR-006) ---------------------
  if (assistants.length === 0) {
    io.error("No assistants to run lanes on.", "Set `tools` in .amby/config.json or pass --assistant=<id>.");
    return 1;
  }
  const refused = assistants.map((a) => ({ a, can: runnable(a, deps.registry) })).filter((x) => !x.can.ok);
  if (refused.length > 0) {
    for (const r of refused) if (!r.can.ok) io.error(`${r.a}: ${r.can.reason}`);
    io.error("Nothing was launched: every assistant needs a verified runner (see `ambykit run --runners`).");
    return 1;
  }

  // --- the record ------------------------------------------------------------------------
  let record: FleetRecord;
  const unattended = flag(opts, "unattended");
  if (existing) {
    record = existing;
    const changes = replan(record, plan);
    if (!json) {
      if (changes.length > 0) io.info(`Re-planned ${record.fleet}; changed since it was planned: ${changes.join("; ")}.`);
      else io.info(`Continuing ${record.fleet}: nothing changed since it was planned.`);
    }
    if (ceilingNote && !json) io.info(ceilingNote);
    record.status = "active";
  } else {
    const made = createFleet(root, { features: plan.features, caps: plan.caps, budgets: plan.budgets, unattended });
    if (!made.ok) {
      io.error(made.warning);
      return 1;
    }
    record = made.fleet;
  }
  const prepareFor = new Map(plan.prepare.map((p) => [p.feature, p.lanes]));
  const caps = existing?.caps ?? settings.concurrency;
  const fleetSettingsForSessions: FleetSettings = { ...settings, concurrency: caps };

  // --- the loop --------------------------------------------------------------------------
  let sup!: FleetSupervisor;
  const ended: SessionRun[] = [];
  const say = (feature: string) => (line: string): void => {
    if (!json) io.info(`[${feature}] ${line}`);
  };
  const sessionFor = (feature: string, run: string, lanes: LaneRef[], assignment: Map<string, string>): Session => {
    const rec = readRun(root, run);
    const runtimes: LaneRuntime[] = lanes.map((ref, i) => {
      const assistant = assignment.get(ref.short) ?? assistants[i % assistants.length]!;
      const saved = readLaneFile(root, run, ref.short);
      const file: LaneFile = saved ?? { lane: ref.short, full: ref.name, assistant, status: "queued", restarts: rec?.lanes.find((l) => l.lane === ref.name)?.restarts ?? 0 };
      if (!saved) writeLaneFile(root, run, file);
      return { ref, assistant: file.assistant, file, job: "worker", round: 1 };
    });
    return {
      root,
      feature,
      run,
      settings: fleetSettingsForSessions,
      budgets: record.budgets,
      registry: deps.registry,
      port: deps.port,
      now: deps.now,
      say: say(feature),
      lanes: runtimes,
      unattended: record.unattended,
      reportsUsage,
      slots: () => sup.slotsFor(feature),
      ...(deps.ask ? { ask: deps.ask } : {}),
    };
  };
  const adopt = (f: FleetFeature): SessionRun | null => {
    const rec = f.run ? readRun(root, f.run) : null;
    if (!f.run || !rec) return null;
    const lanes = laneRefs(primaryRoot(root), f.feature).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const assignment = new Map(rec.lanes.map((l) => [l.lane.slice(l.lane.lastIndexOf(".lane-") + 1), l.assistant]));
    const lock = acquireRunLock(root, f.run, process.pid, (pid) => deps.port.isAlive(pid));
    if (!lock.ok) return null;
    updateRun(root, f.run, { status: "active", needsDecision: false });
    const session = sessionFor(f.feature, f.run, lanes, assignment);
    reviveForContinue(session);
    const run = new SessionRun(f.feature, f.run, session, new Supervisor(session), () => releaseRunLock(root, f.run!, process.pid));
    ended.push(run);
    return run;
  };
  const begin = async (f: FleetFeature): Promise<BeginResult> => {
    const merged = mergeDependencies(root, f.feature, f.waitsFor.map((w) => w.feature));
    if (!merged.ok) return { ok: false, reason: merged.reason };
    let lanes = laneRefs(primaryRoot(root), f.feature);
    if (lanes.length === 0) {
      const prep = await prepareLanes(root, [{ feature: f.feature, lanes: prepareFor.get(f.feature) ?? 2 }], deps.laneRunner);
      if (!prep[0]!.ok) return { ok: false, reason: prep[0]!.reason ?? "its lanes could not be prepared" };
      lanes = laneRefs(primaryRoot(root), f.feature);
      if (lanes.length === 0) return { ok: false, reason: `it has no parallel tasks to lane; run it alone with: ambykit run ${f.feature}` };
    } else {
      const synced = syncLanesWithFeature(root, f.feature);
      if (!synced.ok) return { ok: false, reason: synced.reason };
    }
    lanes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const guard = guardNewRun(root, f.feature, (pid) => deps.port.isAlive(pid));
    if (!guard.ok) return { ok: false, reason: guard.reason };
    const assignment = assignAssistants(lanes.map((l) => l.short), assistants);
    const runLanes: RunLane[] = lanes.map((l) => ({ lane: l.name, assistant: assignment.get(l.short) ?? assistants[0]!, tasks: l.manifest.tasks.map((t) => t.id) }));
    const made = createRun(root, f.feature, { fleet: record.fleet, lanes: runLanes, phase: Math.min(...lanes.map((l) => l.manifest.phase)) });
    if (!made.ok) return { ok: false, reason: made.warning };
    const lock = acquireRunLock(root, made.run.run, process.pid, (pid) => deps.port.isAlive(pid));
    if (!lock.ok) return { ok: false, reason: lock.reason };
    const session = sessionFor(f.feature, made.run.run, lanes, assignment);
    const run = new SessionRun(f.feature, made.run.run, session, new Supervisor(session), () => releaseRunLock(root, made.run.run, process.pid));
    ended.push(run);
    return { ok: true, run };
  };

  const adopted: FeatureRun[] = [];
  if (existing) {
    for (const f of record.features) {
      if (f.state === "done" || f.state === "skipped" || !f.run) continue;
      const run = adopt(f);
      if (run) adopted.push(run);
      else f.state = "waiting";
    }
    for (const f of record.features) if (f.state === "paused" && !adopted.some((a) => a.feature === f.feature)) f.state = "waiting";
  }
  sup = new FleetSupervisor(record, { begin, save: (r) => void updateFleet(root, r.fleet, r), say: (l) => (json ? undefined : io.info(l)), reportsUsage }, adopted);

  let interrupted = false;
  const stop = (): void => {
    interrupted = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let outcome: FleetOutcome;
  try {
    outcome = await superviseFleet(sup, { sleep: deps.sleep, interrupted: () => interrupted, tickMs: settings.tickSeconds * 1000 });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const r of ended) r.end();
  }
  if (json) console.log(JSON.stringify({ fleet: record.fleet, outcome: outcome.kind, message: outcome.message }));
  else if (outcome.kind === "done" || outcome.kind === "interrupted") io.success(outcome.message);
  else io.warn(outcome.message);
  return outcome.kind === "done" || outcome.kind === "interrupted" ? 0 : 1;
}

/**
 * Re-plan a resumed fleet (FR-018): the order, waits and ownership come from the new plan; progress (state, run)
 * stays. Returns what changed since the fleet was planned, per feature, from the stored fingerprints.
 */
export function replan(record: FleetRecord, plan: FleetPlan): string[] {
  const changes: string[] = [];
  const fresh = new Map(plan.features.map((f) => [f.feature, f]));
  for (const f of record.features) {
    const n = fresh.get(f.feature);
    if (!n) continue; // finished since: no longer planned
    if (n.fingerprint !== f.fingerprint) changes.push(`${f.feature} (tasks or dependencies edited)`);
    f.waitsFor = n.waitsFor;
    f.ownership = n.ownership;
    f.fingerprint = n.fingerprint;
  }
  return changes;
}


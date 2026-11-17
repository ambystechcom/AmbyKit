import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { shortLane } from "../core/activity.js";
import { fleetSettings, loadConfig } from "../core/config.js";
import { primaryRoot } from "../core/checkouts.js";
import { git } from "../core/git.js";
import { overlaps } from "../core/lanes.js";
import { findProjectRoot } from "../core/paths.js";
import { isFailed, laneRefs } from "../core/query.js";
import { featureDirOf } from "../core/tasks-edit.js";
import {
  RUN_STAGES,
  UNFINISHED,
  claimFiles,
  createRun,
  damagedRuns,
  determinePhase,
  directiveAction,
  freeSlots,
  laneStatus,
  listRuns,
  nextRoundAction,
  postNote,
  readClaims,
  readDirective,
  readFlowInput,
  readNotes,
  readRun,
  recordOverlap,
  rebuildFromTasks,
  releaseClaims,
  resolveRun,
  restoreRun,
  runDir,
  updateRun,
  writeDirective,
  type DirectiveAction,
  type LaneStatus,
  type RunLane,
  type RunRecord,
  type RunStage,
} from "../core/fleet/index.js";

/**
 * `ambykit fleet` (feature 019): the thin wrapper `/amby.run` and its workers call, so every write to a fleet run
 * goes through one validated path. It holds no state logic of its own: runs, claims, notes, directives and stall
 * detection are spec 025's modules in `src/core/fleet/*`, and the pure decisions (which phase, which round
 * action, overlap records) are `src/core/fleet/run-flow.ts`. This file only parses flags and prints.
 *
 *   fleet start <feature> [--new]            create run <feature>.<n> (explicit request only)
 *   fleet status <feature> [--run] [--json] [--rebuild]
 *   fleet update <feature> [--run] <flags>   phase/stage/round/decision, workers, pause/resume/stop, overlap, done
 *   fleet claim <feature> T### <file>... [--worker=<id>]
 *   fleet release <feature> T###
 *   fleet note <feature> T### <text> [--files=a,b]
 *   fleet directive <feature> <lane>         print the lane's directive: continue, pause or stop
 */
const SUBCOMMANDS = ["start", "status", "update", "claim", "release", "note", "directive"] as const;

export class FleetCommand extends BaseCommand {
  readonly name = "fleet";
  readonly summary = "Start, inspect and update a fleet run (used by /amby.run and its workers).";
  readonly usage = `ambykit fleet <${SUBCOMMANDS.join("|")}> <feature> [options]`;

  protected async execute(opts: CliOptions): Promise<number> {
    const root = findProjectRoot(opts.cwd) ?? opts.cwd;
    const [sub, featureArg, ...rest] = opts.positionals;
    if (!sub || !(SUBCOMMANDS as readonly string[]).includes(sub)) {
      this.error(sub ? `Unknown fleet command '${sub}'.` : "Missing fleet command.", `Usage: ${this.usage}`);
      return 1;
    }
    if (!featureArg) {
      this.error("Missing feature.", `Usage: ${this.usage}`);
      return 1;
    }
    const feature = featureDirOf(root, featureArg);
    if (!feature) {
      this.error(`Feature '${featureArg}' not found.`, "Use a feature number or directory name from specs/.");
      return 1;
    }
    switch (sub) {
      case "start":
        return this.start(root, feature, opts);
      case "status":
        return this.status(root, feature, opts);
      case "update":
        return this.update(root, feature, opts);
      case "claim":
        return this.claim(root, feature, rest, opts);
      case "release":
        return this.release(root, feature, rest, opts);
      case "note":
        return this.note(root, feature, rest, opts);
      default:
        return this.directive(root, feature, rest, opts);
    }
  }

  // --- start (US-1, FR-014) -----------------------------------------------------

  private start(root: string, feature: string, opts: CliOptions): number {
    const step = determinePhase(readFlowInput(root, feature));
    if (step.kind === "stop") {
      this.error(step.message);
      return 1;
    }
    if (step.kind === "unknown") {
      this.error(step.message);
      return 1;
    }
    if (step.kind === "done") {
      console.log(`${feature} is already done; no run started.`);
      return 0;
    }
    const open = listRuns(root, feature).filter((r) => UNFINISHED.includes(r.status));
    if (open.length > 0 && !flag(opts, "new")) {
      this.error(`${feature} already has an unfinished run (${open.map((r) => r.run).join(", ")}).`, "Resume it, or pass --new to start another run on request.");
      return 1;
    }
    const created = createRun(root, feature, { phase: step.phase, stage: step.stage });
    if (!created.ok) {
      this.error(created.warning);
      return 1;
    }
    console.log(`${created.run.run}  phase ${created.run.phase} ${created.run.stage}  limit ${created.run.limit}`);
    return 0;
  }

  // --- status (US-1, US-2, US-5, US-6) --------------------------------------------

  private status(root: string, feature: string, opts: CliOptions): number {
    if (flag(opts, "rebuild")) return this.rebuild(root, feature, opts);
    const settings = fleetSettings(loadConfig(primaryRoot(root)));
    const step = determinePhase(readFlowInput(root, feature));
    const warnings: string[] = [];
    for (const id of damagedRuns(root, feature)) warnings.push(`run ${id} has missing or corrupt state; rebuild it with: ambykit fleet status ${feature} --run=${id} --rebuild`);

    const requested = stringFlag(opts, "run");
    const resolved = resolveRun(root, feature, requested);
    const json = flag(opts, "json");
    const report: Record<string, unknown> = { feature, step };

    if (!resolved.ok) {
      report["run"] = null;
      report["note"] = resolved.warning;
      if (json) console.log(JSON.stringify({ ...report, warnings }, null, 2));
      else {
        console.log(`${feature}: ${describeStep(step)}`);
        console.log(resolved.warning);
        for (const w of warnings) console.log(`warning: ${w}`);
      }
      return 0;
    }

    const run = resolved.run;
    const lanes = run.lanes.map((l) => laneLine(root, feature, run, l, settings.restartLimit));
    const runningAssistants = run.lanes.filter((l) => laneIsRunning(root, run, l)).map((l) => l.assistant);
    const slots = freeSlots(runningAssistants, settings.concurrency);
    const claims = readClaims(root, run.run);
    const notes = readNotes(root, run.run);

    // A task that is checked must not hold claims (FR-017); an edit with no claim is worth a look.
    const input = readFlowInput(root, feature);
    const checked = new Set(input.tasks.filter((t) => t.done).map((t) => t.id));
    for (const [file, c] of Object.entries(claims)) if (checked.has(c.task)) warnings.push(`${c.task} is checked off but still claims ${file}; run: ambykit fleet release ${feature} ${c.task}`);
    for (const w of unclaimedEdits(root, feature, run, Object.keys(claims))) warnings.push(w);

    Object.assign(report, { run: run.run, status: run.status, phase: run.phase, stage: run.stage, round: run.round, limit: run.limit, needsDecision: run.needsDecision, lanes, slots, claims: Object.keys(claims).length, notes: notes.length });
    if (json) {
      console.log(JSON.stringify({ ...report, warnings }, null, 2));
      return 0;
    }
    console.log(`${run.run}  ${run.status}  phase ${run.phase} ${run.stage}  round ${run.round}/${run.limit}${run.needsDecision ? "  NEEDS A DECISION" : ""}`);
    console.log(`Next: ${describeStep(step)}`);
    if (lanes.length === 0) console.log("Lanes: none yet");
    for (const l of lanes) {
      const bits = [l.lane, l.assistant, l.tasks.join(","), l.done ? "done" : l.state, l.idleMinutes !== undefined ? `idle ${l.idleMinutes}m` : "no report", `directive ${l.directive}`, `restarts left ${l.restartsLeft}`];
      console.log(`  ${bits.join("  ")}`);
      if (l.action) console.log(`    -> ${l.action}`);
    }
    const perType = Object.entries(slots.perType).map(([a, s]) => `${a} ${s.running}/${settings.concurrency.perType}`);
    console.log(`Slots: ${slots.free} of ${settings.concurrency.total} free${perType.length ? ` (${perType.join(", ")})` : ""}`);
    console.log(`Claims: ${Object.keys(claims).length}  Notes: ${notes.length}`);
    for (const w of warnings) console.log(`warning: ${w}`);
    return 0;
  }

  // --- rebuild (US-5, FR-015) ------------------------------------------------------

  private rebuild(root: string, feature: string, opts: CliOptions): number {
    const requested = stringFlag(opts, "run");
    const targets = requested ? [requested] : damagedRuns(root, feature);
    if (targets.length === 0) {
      console.log(`No run of ${feature} has missing or corrupt state; nothing to rebuild.`);
      return 0;
    }
    const settings = fleetSettings(loadConfig(primaryRoot(root)));
    const input = readFlowInput(root, feature);
    let failures = 0;
    for (const id of targets) {
      if (!id.startsWith(`${feature}.`)) {
        this.error(`'${id}' is not a run of ${feature}.`);
        failures += 1;
        continue;
      }
      const record = rebuildFromTasks(input, { run: id, feature, limit: settings.roundLimit }, salvage(root, id));
      const out = restoreRun(root, record);
      if (!out.ok) {
        this.error(out.warning);
        failures += 1;
        continue;
      }
      const checked = input.tasks.filter((t) => t.done).length;
      console.log(`rebuilt ${id} from tasks.md: phase ${record.phase} ${record.stage}, ${record.status}; ${checked} checked task(s) kept`);
    }
    return failures ? 1 : 0;
  }

  // --- update (US-2, US-4, US-5, US-7) -----------------------------------------------

  private update(root: string, feature: string, opts: CliOptions): number {
    const resolved = resolveRun(root, feature, stringFlag(opts, "run"));
    if (!resolved.ok) {
      this.error(resolved.warning);
      return 1;
    }
    const run = resolved.run;
    const settings = fleetSettings(loadConfig(primaryRoot(root)));
    const patch: Partial<Omit<RunRecord, "run" | "feature" | "createdAt">> = {};
    let lanes: RunLane[] = [...run.lanes];
    const out: string[] = [];

    const stage = stringFlag(opts, "stage");
    if (stage !== undefined) {
      if (!(RUN_STAGES as readonly string[]).includes(stage)) return this.fail(`invalid stage '${stage}'; allowed: ${RUN_STAGES.join(", ")}`);
      patch.stage = stage as RunStage;
    }
    const phase = stringFlag(opts, "phase");
    if (phase !== undefined) {
      const n = Number(phase);
      if (!Number.isInteger(n) || n < 0) return this.fail(`invalid phase '${phase}'`);
      patch.phase = n;
      patch.round = 0; // a new phase starts a new review loop
      patch.stage ??= "working";
    }

    const round = stringFlag(opts, "round");
    if (round !== undefined) {
      const n = Number(round);
      if (!Number.isInteger(n) || n < 0) return this.fail(`invalid round '${round}'`);
      patch.round = n;
      const action = nextRoundAction(n, run.limit);
      out.push(`round ${n}/${run.limit}: ${action}`);
      if (action === "escalate") {
        patch.needsDecision = true;
        patch.status = "waiting-person";
      }
    }

    const decision = stringFlag(opts, "decision");
    if (decision !== undefined) {
      if (decision.trim() === "") return this.fail("a decision needs some text");
      patch.escalations = [...run.escalations, { at: new Date().toISOString(), phase: patch.phase ?? run.phase, round: run.round, decision: decision.trim() }];
      patch.needsDecision = false;
      if (run.status === "waiting-person" && patch.status === undefined) patch.status = "active";
      out.push("decision recorded");
    }

    const start = stringFlag(opts, "worker-start");
    if (start !== undefined) {
      const assistant = stringFlag(opts, "assistant");
      const tasks = (stringFlag(opts, "tasks") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      if (!assistant || tasks.length === 0) return this.fail("--worker-start needs --assistant=<id> and --tasks=T001,T002");
      const short = shortLane(start.startsWith("lane-") || start.includes(".lane-") ? start : `lane-${start}`);
      const already = lanes.find((l) => shortLane(l.lane) === short);
      const running = lanes.filter((l) => laneIsRunning(root, run, l) && shortLane(l.lane) !== short).map((l) => l.assistant);
      const slots = freeSlots(running, settings.concurrency);
      if (slots.free < 1) return this.fail(`no free slot: ${slots.running} of ${settings.concurrency.total} workers are running; wait for one to finish`);
      const mine = slots.perType[assistant];
      if (mine && mine.free < 1) return this.fail(`no free slot for ${assistant}: ${mine.running} of ${settings.concurrency.perType} are running`);
      const entry: RunLane = { ...(already ?? {}), lane: `${feature}.${short}`, assistant, tasks, done: false };
      lanes = already ? lanes.map((l) => (l === already ? entry : l)) : [...lanes, entry];
      out.push(`${short} started (${assistant}: ${tasks.join(", ")})`);
    }

    const done = stringFlag(opts, "worker-done");
    if (done !== undefined) {
      const hit = lanes.find((l) => shortLane(l.lane) === shortLane(done.startsWith("lane-") ? done : `lane-${done}`));
      if (!hit) return this.fail(`lane '${done}' is not in run ${run.run}`);
      lanes = lanes.map((l) => (l === hit ? { ...l, done: true } : l));
      out.push(`${shortLane(hit.lane)} done`);
    }

    const restart = stringFlag(opts, "restart");
    if (restart !== undefined) {
      const hit = lanes.find((l) => shortLane(l.lane) === shortLane(restart.startsWith("lane-") ? restart : `lane-${restart}`));
      if (!hit) return this.fail(`lane '${restart}' is not in run ${run.run}`);
      const used = hit.restarts ?? 0;
      if (used >= settings.restartLimit) {
        // FR-026: after the restarts are spent the lane pauses and a person decides.
        const w = writeDirective(root, { feature, lane: shortLane(hit.lane), action: "pause", run: run.run });
        updateRun(root, run.run, { needsDecision: true, status: "waiting-person" });
        this.error(`${shortLane(hit.lane)} has used its ${settings.restartLimit} restarts${w.ok ? "; paused" : ""}.`, "Ask a person: only they may move it to another assistant or mark its task BLOCKED.");
        return 1;
      }
      lanes = lanes.map((l) => (l === hit ? { ...l, restarts: used + 1 } : l));
      out.push(`${shortLane(hit.lane)} restart ${used + 1} of ${settings.restartLimit}`);
    }

    const overlap = stringFlag(opts, "overlap");
    if (overlap !== undefined) {
      if (overlap !== "serialized" && overlap !== "squad") return this.fail("--overlap must be serialized or squad");
      const list = (name: string): string[] => (stringFlag(opts, name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const writers: Record<string, string> = {};
      for (const pair of list("writer")) {
        const at = pair.lastIndexOf(":");
        if (at < 1) return this.fail(`--writer entries are path:lane, got '${pair}'`);
        writers[pair.slice(0, at)] = pair.slice(at + 1);
      }
      const res = recordOverlap(lanes, { mode: overlap, lanes: list("lanes"), shared: list("shared"), writers, mergeOrder: list("order") });
      if (!res.ok) return this.fail(res.error);
      lanes = res.lanes;
      out.push(`${overlap} recorded for ${list("lanes").join(", ")}`);
    }

    const verbs: [string, DirectiveAction][] = [["pause", "pause"], ["resume", "continue"], ["stop", "stop"]];
    for (const [name, action] of verbs) {
      const value = opts.flags[name];
      if (value === undefined) continue;
      const targets = typeof value === "string" ? [value] : lanes.filter((l) => !l.done).map((l) => shortLane(l.lane));
      for (const lane of targets) {
        const w = writeDirective(root, { feature, lane, action, run: run.run });
        if (!w.ok) return this.fail(w.error);
        out.push(`${name} sent to ${w.lane}; the worker obeys at its next report`);
      }
      if (typeof value !== "string") patch.status = name === "resume" ? "active" : "paused";
    }

    if (flag(opts, "done")) {
      const step = determinePhase(readFlowInput(root, feature));
      if (step.kind !== "done") return this.fail(`${feature} is not finished (${describeStep(step)}); a run is done only when every phase is checked and verified`);
      patch.status = "done";
      out.push("run done");
    }

    if (lanes.length !== run.lanes.length || lanes.some((l, i) => l !== run.lanes[i])) patch.lanes = lanes;
    if (Object.keys(patch).length > 0) {
      const res = updateRun(root, run.run, patch);
      if (!res.ok) return this.fail(res.warning);
    } else if (out.length === 0) {
      return this.fail("nothing to update; see `ambykit fleet` usage in docs/cli-reference.md");
    }
    for (const line of out) console.log(line);
    return 0;
  }

  // --- claims, notes, directive (US-6) --------------------------------------------------

  private claim(root: string, feature: string, rest: string[], opts: CliOptions): number {
    const [task, ...files] = rest;
    const run = resolveRun(root, feature, stringFlag(opts, "run"));
    if (!run.ok) return this.fail(run.warning);
    if (!task) return this.fail("usage: ambykit fleet claim <feature> T### <file>... [--worker=<id>]");
    const res = claimFiles(root, run.run.run, { task: task.toUpperCase(), files, worker: stringFlag(opts, "worker") ?? "worker" });
    if ("refused" in res) {
      this.error(`${res.refused.file} is held by ${res.refused.owner} (${res.refused.task}); do not edit it.`, "Post a note and tell the lead you are blocked.");
      return 1;
    }
    if (!res.ok) return this.fail(res.error);
    console.log(`claimed ${res.claimed.join(", ")} for ${task.toUpperCase()}`);
    return 0;
  }

  private release(root: string, feature: string, rest: string[], opts: CliOptions): number {
    const [task] = rest;
    const run = resolveRun(root, feature, stringFlag(opts, "run"));
    if (!run.ok) return this.fail(run.warning);
    if (!task) return this.fail("usage: ambykit fleet release <feature> T###");
    const freed = releaseClaims(root, run.run.run, task.toUpperCase());
    console.log(freed.length ? `released ${freed.join(", ")}` : `${task.toUpperCase()} held no claims`);
    return 0;
  }

  private note(root: string, feature: string, rest: string[], opts: CliOptions): number {
    const [task, ...words] = rest;
    const run = resolveRun(root, feature, stringFlag(opts, "run"));
    if (!run.ok) return this.fail(run.warning);
    if (!task) return this.fail("usage: ambykit fleet note <feature> T### <text> [--files=a,b]");
    const files = (stringFlag(opts, "files") ?? "").split(",").map((f) => f.trim()).filter(Boolean);
    const res = postNote(root, run.run.run, { task: task.toUpperCase(), files, text: words.join(" ") });
    if (!res.ok) return this.fail(res.error);
    console.log(res.line);
    return 0;
  }

  private directive(root: string, feature: string, rest: string[], opts: CliOptions): number {
    const [lane] = rest;
    if (!lane) return this.fail("usage: ambykit fleet directive <feature> <lane>");
    const run = resolveRun(root, feature, stringFlag(opts, "run"));
    // No run, or no directive, means continue: a worker must never stop because the state is missing.
    console.log(run.ok ? directiveAction(readDirective(root, run.run.run, shortLane(lane.startsWith("lane-") ? lane : `lane-${lane}`))) : "continue");
    return 0;
  }

  private fail(message: string): number {
    this.error(message);
    return 1;
  }
}

// --- helpers ----------------------------------------------------------------------------

function describeStep(step: ReturnType<typeof determinePhase>): string {
  switch (step.kind) {
    case "stop":
      return step.message;
    case "unknown":
      return step.message;
    case "done":
      return step.needsConverge ? "every phase is done; run /amby.converge, then mark the spec done" : "done";
    default:
      return `phase ${step.phase} (${step.stage}): ${step.pending.length ? `${step.pending.join(", ")} pending` : "no pending task"}${step.blocked.length ? `; blocked: ${step.blocked.join(", ")}` : ""}`;
  }
}

/** A lane counts as running while it is not done and its directive is not pause or stop. */
function laneIsRunning(root: string, run: RunRecord, lane: RunLane): boolean {
  if (lane.done) return false;
  return directiveAction(readDirective(root, run.run, shortLane(lane.lane))) === "continue";
}

interface LaneView {
  lane: string;
  assistant: string;
  tasks: string[];
  done: boolean;
  state: string;
  stalled: boolean;
  idleMinutes?: number;
  directive: string;
  restartsLeft: number;
  /** What the lead should do next about this lane, when something is wrong. */
  action?: string;
}

function laneLine(root: string, feature: string, run: RunRecord, lane: RunLane, restartLimit: number): LaneView {
  const short = shortLane(lane.lane);
  const st = laneStatus(root, { feature, lane: short, run: run.run });
  const status: LaneStatus | null = isFailed(st) ? null : st;
  const restartsLeft = Math.max(0, restartLimit - (lane.restarts ?? 0));
  const view: LaneView = {
    lane: short,
    assistant: lane.assistant,
    tasks: lane.tasks,
    done: lane.done === true,
    state: status?.state ?? "unreported",
    stalled: status?.stalled === true && !lane.done,
    ...(status?.idleMinutes !== undefined ? { idleMinutes: status.idleMinutes } : {}),
    directive: status ? `${status.directive.action}${status.directive.status === "none" ? "" : ` (${status.directive.status})`}` : "continue",
    restartsLeft,
  };
  if (view.stalled) {
    view.action =
      restartsLeft > 0
        ? `stalled: restart it with ambykit fleet update ${feature} --restart=${short} (${restartsLeft} left)`
        : `stalled with no restarts left: pause it and ask a person (ambykit fleet update ${feature} --pause=${short})`;
  }
  return view;
}

/** Readable arrays from a damaged `run.json`, so a rebuild keeps what it can (FR-015). */
function salvage(root: string, run: string): Partial<Pick<RunRecord, "gates" | "lanes" | "approvals" | "escalations">> {
  const file = join(runDir(root, run), "run.json");
  if (!existsSync(file) || readRun(root, run)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const pick = <K extends "gates" | "lanes" | "approvals" | "escalations">(k: K): Partial<Pick<RunRecord, K>> => (Array.isArray(raw[k]) ? ({ [k]: raw[k] } as Pick<RunRecord, K>) : {});
    return { ...pick("gates"), ...pick("lanes"), ...pick("approvals"), ...pick("escalations") };
  } catch {
    return {};
  }
}

const NOT_SOURCE = [/^specs\//, /^\.amby\//, /^node_modules\//, /^dist\//];

/** Files changed in a lane's checkout that no claim covers (FR-017 is advisory, so this is a warning, never an error). */
function unclaimedEdits(root: string, feature: string, run: RunRecord, claimed: string[]): string[] {
  const out: string[] = [];
  const refs = laneRefs(root, feature);
  for (const l of run.lanes) {
    if (l.done) continue;
    const ref = refs.find((r) => r.short === shortLane(l.lane));
    if (!ref) continue;
    let changed: string[] = [];
    try {
      changed = git(ref.root, ["status", "--porcelain"]).split(/\r?\n/).map((r) => r.slice(3).trim().replace(/^"|"$/g, "")).filter(Boolean);
    } catch {
      continue;
    }
    for (const file of changed) {
      if (NOT_SOURCE.some((re) => re.test(file))) continue;
      if (!claimed.some((c) => overlaps(file.toLowerCase(), c))) out.push(`${ref.short} changed ${file} with no claim`);
    }
  }
  return out;
}

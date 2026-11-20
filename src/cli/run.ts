import { relative } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { nodeProcessPort, type ProcessPort } from "./run-process.js";
import { runFleet } from "./run-fleet.js";
import { controlFleet, type FleetAction } from "./run-fleet-control.js";
import type { LaneRunner } from "./run-fleet-prepare.js";
import { buildLaunchPlan, laneOpenTasks, nextRunId } from "./run-plan.js";
import { emitScripts } from "./run-script.js";
import { fleetSettings, loadConfig, type FleetSettings } from "../core/config.js";
import { readRun, updateRun, type RunLane } from "../core/fleet/index.js";
import { approveGate, approveReassign, rejectGate } from "../core/run-gate-actions.js";
import { acquireRunLock, bootstrapRun, openRun, readLaneFile, releaseRunLock, writeLaneFile, type LaneFile } from "./run-files.js";
import { reviveForContinue } from "./run-control.js";
import { Supervisor, superviseRun, type Outcome } from "./run-loop.js";
import type { LaneRuntime, Session } from "./run-session.js";
import { primaryRoot } from "../core/checkouts.js";
import { refusals, type LaunchEntry } from "../core/run-launch-plan.js";
import { laneRefs, type LaneRef } from "../core/query.js";
import { RUNNERS, listRunners, type RunnerSpec } from "../core/runners.js";
import { resolveBudgets, type Budgets } from "../core/run-supervise.js";
import { isExperimental, stabilityLabel, withStability } from "../core/run-stability.js";
import { featureDirOf } from "../core/tasks-edit.js";

/**
 * `ambykit run <feature>` — headless lane orchestration (feature 028). **Experimental in 1.6** (FR-019): the
 * command, its flags and the runner commands may change before 2.0, when it is promoted to stable.
 *
 * Launching processes that edit code is the riskiest thing AmbyKit does, so nothing launches without
 * `--yes` (FR-001, FR-002), `--emit-script` writes the commands and launches nothing (FR-003), and an
 * assistant without a verified runner is refused (FR-006). State lives under `.amby/fleet/<run>/`, owned by
 * spec 025 (FR-017); nothing is written outside the project (FR-020).
 */
export const EXPERIMENTAL_NOTE = "ambykit run is experimental in 1.6: its flags and runner commands may change before it is stable in 2.0.";

const SUBCOMMANDS = ["approve", "reject"] as const;
/** Feature 031: whole-fleet control, `ambykit run pause|stop|resume <fleet>`. */
const FLEET_CONTROL = ["pause", "stop", "resume"] as const;

/** Everything a test needs to replace so no real assistant, clock or terminal is involved (Principle 5). */
export interface RunDeps {
  registry: RunnerSpec[];
  port: ProcessPort;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** True when a person can answer a prompt on this terminal. */
  interactive: boolean;
  /** Ask a yes/no question; `undefined` = no answer (not interactive). */
  ask?: (question: string) => Promise<boolean | undefined>;
  /** Feature 031: how a fleet prepares missing lanes (default: the lane command in-process). */
  laneRunner?: LaneRunner;
}

const realDeps = (): RunDeps => ({
  registry: RUNNERS,
  port: nodeProcessPort,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
});

/** The resolved facts of one invocation, shared by the preview, the script writer and the launch. */
export interface RunContext {
  root: string;
  feature: string;
  lanes: LaneRef[];
  assistants: string[];
  run: string;
  settings: FleetSettings;
  budgets: Budgets;
  unattended: boolean;
  plan: LaunchEntry[];
  opts: CliOptions;
  /** Set by `--continue-run`: the existing run this invocation continues. */
  continueRun?: string;
}

export class RunCommand extends BaseCommand {
  readonly name = "run";
  readonly summary = `${stabilityLabel()} Run a feature's prepared lanes headless: print, launch, supervise, merge.`.trim();
  readonly usage =
    "ambykit run <feature> [<feature>...|--all-ready] [--yes] [--emit-script] [--assistant=<id,id>] [--unattended] [--max-minutes=N] [--max-tasks=N] [--max-tokens=N] [--continue-run=<run>] [--continue-fleet=<fleet>] [--json] | pause|stop|resume <fleet> | --runners | approve|reject <run> [--gate=<id>] [--reason=<text>] | approve <run> --reassign=<lane>:<assistant>";

  protected readonly deps: RunDeps;

  constructor(deps: Partial<RunDeps> = {}) {
    super();
    this.deps = { ...realDeps(), ...deps };
  }

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const [first, second] = opts.positionals;
    const cont = stringFlag(opts, "continue-run");

    if (flag(opts, "runners")) return this.listRunnerRows(opts);
    if (first && (SUBCOMMANDS as readonly string[]).includes(first)) return this.gate(root, first as (typeof SUBCOMMANDS)[number], second, opts);
    if (first && (FLEET_CONTROL as readonly string[]).includes(first)) return this.fleetControl(root, first as FleetAction, second, opts);

    // Feature 031: several features, --all-ready or --continue-fleet start (or resume) a fleet; one feature is a single run.
    let single = first;
    let warned = false;
    if (!cont && (opts.positionals.length >= 2 || flag(opts, "all-ready") || stringFlag(opts, "continue-fleet"))) {
      if (!flag(opts, "json")) {
        if (isExperimental()) this.warn(EXPERIMENTAL_NOTE);
        warned = true;
      }
      const io = { info: (m: string) => this.info(m), warn: (m: string) => this.warn(m), error: (m: string, h?: string) => this.error(m, h), success: (m: string) => this.success(m) };
      const entry = await runFleet(root, opts.positionals, opts, this.deps, io);
      if (typeof entry === "number") return entry;
      single = entry.single; // a fleet of one feature is a single run, unchanged
    }

    const featureArg = single ?? (cont ? cont.slice(0, cont.lastIndexOf(".")) : undefined);
    if (!featureArg) {
      this.error("Missing feature.", `Usage: ${this.usage}`);
      return 1;
    }
    const feature = featureDirOf(root, featureArg);
    if (!feature) {
      this.error(`Feature '${featureArg}' not found.`, "Use a feature number or directory name from specs/.");
      return 1;
    }
    if (!flag(opts, "json") && !warned && isExperimental()) this.warn(EXPERIMENTAL_NOTE);

    const lanes = preparedLanes(root, feature);
    if (lanes.length === 0) {
      this.error(`${feature} has no prepared lanes.`, `Create them first with: ambykit lane ${feature}`);
      return 1;
    }
    return this.start(root, feature, lanes, opts);
  }

  // --- US-1: preview, --yes, --emit-script (FR-001..FR-003) --------------------------------

  protected async start(root: string, feature: string, lanes: LaneRef[], opts: CliOptions): Promise<number> {
    const json = flag(opts, "json");
    const config = loadConfig(primaryRoot(root));
    const settings = fleetSettings(config);
    const assistants = assistantsFor(root, opts);
    if (assistants.length === 0) {
      this.error("No assistants to run lanes on.", "Set `tools` in .amby/config.json or pass --assistant=<id>.");
      return 1;
    }
    const cont = stringFlag(opts, "continue-run");
    let run = nextRunId(root, feature);
    let assignment: Map<string, string> | undefined;
    if (cont) {
      const opened = openRun(root, cont);
      if (!opened.ok) {
        this.error(opened.reason);
        return 1;
      }
      run = cont;
      assignment = new Map(opened.record.lanes.map((l) => [l.lane.slice(l.lane.lastIndexOf(".lane-") + 1), l.assistant]));
      if (opened.rebuilt && !json) this.warn(`Run ${cont} had missing state and was rebuilt from tasks.md; checked tasks stay checked.`);
    }
    const budgets = resolveBudgets({
      openTasks: lanes.reduce((n, l) => n + laneOpenTasks(l).length, 0),
      config: settings.budgets,
      flags: budgetFlags(opts),
    });
    const plan = buildLaunchPlan({ root, feature, lanes, assistants, run, settings, registry: this.deps.registry, ...(assignment ? { assignment } : {}) });
    const ctx: RunContext = { root, feature, lanes, assistants, run, settings, budgets, unattended: flag(opts, "unattended"), plan, opts, ...(cont ? { continueRun: cont } : {}) };
    const refused = refusals(plan);

    if (json) console.log(JSON.stringify(this.planJson(ctx, flag(opts, "yes") && refused.length === 0)));
    else this.printPlan(ctx);

    if (flag(opts, "emit-script")) {
      if (refused.length > 0) return this.refuse(refused, json);
      const out = emitScripts(root, feature, plan, settings.concurrency.total);
      if (!json) this.success(`Wrote ${relative(root, out.sh)} and ${relative(root, out.ps1)}. Nothing was launched.`);
      return 0;
    }
    if (!this.assumeYes) {
      if (!json) this.info("Nothing launched. Re-run with --yes to launch these lanes, or --emit-script to write the commands to a script.");
      return 0;
    }
    if (refused.length > 0) return this.refuse(refused, json);
    return this.launch(ctx);
  }

  // --- US-2: launch and supervise (FR-004, FR-005, FR-008..FR-018) --------------------------

  /** Create (or continue) the run, start the lanes under the caps and supervise until it ends. */
  protected async launch(ctx: RunContext): Promise<number> {
    const { root, feature } = ctx;
    const port = this.deps.port;
    let run = ctx.continueRun;
    if (!run) {
      const lanes: RunLane[] = ctx.plan.map((e) => ({
        lane: e.full,
        assistant: e.assistant,
        tasks: ctx.lanes.find((l) => l.short === e.lane)!.manifest.tasks.map((t) => t.id),
      }));
      const boot = bootstrapRun(root, feature, lanes, (pid) => port.isAlive(pid), Math.min(...ctx.lanes.map((l) => l.manifest.phase)));
      if (!boot.ok) {
        this.error(boot.warning);
        return 1;
      }
      run = boot.run.run;
    }
    const runId = run;
    const lock = acquireRunLock(root, runId, process.pid, (pid) => port.isAlive(pid));
    if (!lock.ok) {
      this.error(lock.reason);
      return 1;
    }
    try {
      if (ctx.continueRun) updateRun(root, runId, { status: "active", needsDecision: false });
      const session = this.session(ctx, runId);
      if (ctx.continueRun) {
        const back = reviveForContinue(session);
        if (back.length > 0 && !flag(ctx.opts, "json")) this.info(`Continuing ${runId}: ${back.join(", ")} will start again with their unchecked tasks only.`);
      }
      const sup = new Supervisor(session);
      let interrupted = false;
      const stop = (): void => {
        interrupted = true;
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      let outcome: Outcome;
      try {
        outcome = await superviseRun(sup, session, {
          sleep: this.deps.sleep,
          interrupted: () => interrupted,
          onGate: (gate) => this.askGate(ctx, runId, gate),
        });
      } finally {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
      }
      if (flag(ctx.opts, "json")) console.log(JSON.stringify({ run: runId, outcome: outcome.kind, message: outcome.message }));
      else if (outcome.kind === "done" || outcome.kind === "interrupted") this.success(outcome.message);
      else this.warn(outcome.message);
      return outcome.kind === "done" || outcome.kind === "interrupted" ? 0 : 1;
    } finally {
      releaseRunLock(root, runId, process.pid);
    }
  }

  /** Build the session from the run's saved lane files, so a continued run picks up where it was. */
  protected session(ctx: RunContext, run: string): Session {
    const rec = readRun(ctx.root, run);
    const lanes: LaneRuntime[] = ctx.lanes.map((ref, i) => {
      const assistant = ctx.plan.find((e) => e.lane === ref.short)?.assistant ?? ctx.assistants[i % ctx.assistants.length]!;
      const saved = readLaneFile(ctx.root, run, ref.short);
      const file: LaneFile = saved ?? {
        lane: ref.short,
        full: ref.name,
        assistant,
        status: "queued",
        restarts: rec?.lanes.find((l) => l.lane === ref.name)?.restarts ?? 0,
      };
      if (!saved) writeLaneFile(ctx.root, run, file);
      return { ref, assistant: file.assistant, file, job: "worker", round: 1 };
    });
    return {
      root: ctx.root,
      feature: ctx.feature,
      run,
      settings: ctx.settings,
      budgets: ctx.budgets,
      registry: this.deps.registry,
      port: this.deps.port,
      now: this.deps.now,
      say: (line) => {
        if (!flag(ctx.opts, "json")) this.info(line);
      },
      lanes,
      unattended: ctx.unattended,
      reportsUsage: lanes.every((l) => this.deps.registry.find((r) => r.id === l.assistant)?.reportsUsage === true),
      ...(this.deps.ask ? { ask: this.deps.ask } : {}),
    };
  }

  /** The foreground prompt for a checkpoint; without a terminal the run just waits for `ambykit run approve`. */
  private readonly asked = new Set<string>();
  private async askGate(ctx: RunContext, run: string, gate: string): Promise<void> {
    if (!this.deps.interactive || !this.deps.ask || this.asked.has(`${run}:${gate}`)) return;
    this.asked.add(`${run}:${gate}`);
    const yes = await this.deps.ask(`Checkpoint ${gate} reached. Approve and start the next set?`);
    if (yes === true) approveGate(ctx.root, run, { gate, by: "person (terminal)" });
    else if (yes === false) rejectGate(ctx.root, run, { gate, by: "person (terminal)" });
  }

  private refuse(refused: { lane: string; assistant: string; reason: string }[], json: boolean): number {
    if (!json) for (const r of refused) this.error(`${r.lane} (${r.assistant}): ${r.reason}`);
    this.error("Nothing was launched: every lane needs a verified runner (see `ambykit run --runners`).");
    return 1;
  }

  private printPlan(ctx: RunContext): void {
    const { settings, budgets } = ctx;
    this.info(ctx.continueRun ? withStability(`Continuing run ${ctx.run} of ${ctx.feature}`) : withStability(`Run plan for ${ctx.feature} — run ${ctx.run}`));
    this.info(
      `Lanes: ${ctx.lanes.length} · assistants: ${[...new Set(ctx.plan.map((e) => e.assistant))].join(", ")} · caps: ${settings.concurrency.total} at once, ${settings.concurrency.perType} per assistant`,
    );
    const tokens = budgets.maxTokens !== undefined ? `, ${budgets.maxTokens} tokens` : "";
    this.info(`Budgets: ${budgets.wallClockMinutes} minutes wall-clock, ${budgets.maxTasks} task events${tokens}`);
    const reports = ctx.plan.every((e) => this.deps.registry.find((r) => r.id === e.assistant)?.reportsUsage === true);
    if (budgets.maxTokens !== undefined && !reports) {
      this.info("Token ceiling: not enforceable for this runner (it does not report usage); the wall-clock and task budgets still apply.");
    }
    this.info(
      ctx.unattended
        ? "Mode: UNATTENDED — story checkpoints are approved automatically. A person is not asked."
        : "Mode: attended — the run stops at each story checkpoint until a person approves it.",
    );
    for (const e of ctx.plan) {
      const lane = ctx.lanes.find((l) => l.short === e.lane);
      this.info(`  ${e.lane}  ${e.assistant}  ${lane ? laneOpenTasks(lane).join(", ") : ""}`);
      this.info(`    ${e.display}`);
    }
  }

  private planJson(ctx: RunContext, launching: boolean): unknown {
    return {
      experimental: isExperimental(),
      feature: ctx.feature,
      run: ctx.run,
      launched: false,
      launching,
      caps: ctx.settings.concurrency,
      budgets: ctx.budgets,
      unattended: ctx.unattended,
      lanes: ctx.plan.map((e) => ({ lane: e.lane, assistant: e.assistant, cwd: e.cwd, command: e.display, ...(e.refused ? { refused: e.refused } : {}) })),
    };
  }

  /** `--runners`: the headless runners, what each can do and why a refused one is refused (FR-006, FR-007). */
  protected listRunnerRows(opts: CliOptions): number {
    const rows = listRunners(this.deps.registry);
    if (flag(opts, "json")) {
      console.log(JSON.stringify(rows));
      return 0;
    }
    this.info(`${withStability("Headless runners")}. Only a verified runner can be launched.`);
    for (const r of rows) {
      const status = r.verified ? `verified${r.verifiedVersion ? ` (${r.verifiedVersion})` : ""}` : "unverified";
      this.info(`  ${r.id}  ${r.label}  ${status}  usage ${r.reportsUsage ? "reported" : "not reported"}  ${r.runnable ? "runnable" : "not runnable"}`);
      if (r.reason) this.info(`    ${r.reason}`);
    }
    return 0;
  }

  /** `ambykit run pause|stop|resume <fleet>`: one directive per lane of every feature of the fleet (031 FR-015). */
  protected fleetControl(root: string, action: FleetAction, fleet: string | undefined, opts: CliOptions): number {
    if (!fleet) {
      this.error("Missing fleet.", `Usage: ambykit run ${action} <fleet>`);
      return 1;
    }
    const out = controlFleet(root, fleet, action);
    if (!out.ok) {
      this.error(out.error ?? "could not write the directives");
      return 1;
    }
    if (flag(opts, "json")) console.log(JSON.stringify({ fleet, action, lanes: out.written }));
    else this.success(`Asked ${out.written.length} lane${out.written.length === 1 ? "" : "s"} of ${fleet} to ${action === "resume" ? "continue" : action}; each worker obeys at its next report.`);
    return 0;
  }

  /** `ambykit run approve|reject <run>`: the one pair of gate functions the dashboard calls too (FR-015). */
  protected async gate(root: string, verb: (typeof SUBCOMMANDS)[number], run: string | undefined, opts: CliOptions): Promise<number> {
    if (!run) {
      this.error("Missing run.", `Usage: ambykit run ${verb} <run> [--gate=<id>] [--reason=<text>]`);
      return 1;
    }
    const reason = stringFlag(opts, "reason");
    const reassign = stringFlag(opts, "reassign");
    if (reassign) {
      // FR-009: a lane moves to another assistant only with a person's approval, recorded here.
      const [lane, to] = reassign.split(":");
      if (verb !== "approve" || !lane || !to) {
        this.error("Use: ambykit run approve <run> --reassign=<lane>:<assistant>");
        return 1;
      }
      const moved = approveReassign(root, run, lane, to, "person");
      if (!moved.ok) {
        this.error(moved.error);
        return 1;
      }
      this.success(`Approved moving ${lane} of ${run} to ${to}; the run applies it on its next check.`);
      return 0;
    }
    const gate = stringFlag(opts, "gate");
    const input = { ...(gate ? { gate } : {}), ...(reason ? { reason } : {}), by: "person" };
    const out = verb === "approve" ? approveGate(root, run, input) : rejectGate(root, run, input);
    if (!out.ok) {
      this.error(out.error);
      return 1;
    }
    if (flag(opts, "json")) console.log(JSON.stringify({ run, gate: out.gate.id, decision: verb === "approve" ? "approved" : "rejected", status: out.run.status }));
    else if (verb === "approve") this.success(`Approved ${out.gate.id} of ${run}; the run starts the next set.`);
    else this.success(`Rejected ${out.gate.id} of ${run}${reason ? `: ${reason}` : ""}; the run is paused.`);
    return 0;
  }
}

/** The feature's prepared lanes in phase, then lane-index order (the order they are started and merged). */
export function preparedLanes(root: string, feature: string): LaneRef[] {
  return laneRefs(primaryRoot(root), feature).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** The assistants lanes are spread over: `--assistant`, else `fleet.runners`, else the configured tools. */
export function assistantsFor(root: string, opts: CliOptions): string[] {
  const flagged = stringFlag(opts, "assistant");
  if (flagged) return flagged.split(",").map((s) => s.trim()).filter(Boolean);
  const config = loadConfig(primaryRoot(root));
  const settings = fleetSettings(config);
  return settings.runners.length > 0 ? settings.runners : config.tools;
}

function budgetFlags(opts: CliOptions): Partial<Budgets> {
  const n = (name: string): number | undefined => {
    const v = stringFlag(opts, name);
    const x = v === undefined ? NaN : Number(v);
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const out: Partial<Budgets> = {};
  const m = n("max-minutes");
  const t = n("max-tasks");
  const k = n("max-tokens");
  if (m !== undefined) out.wallClockMinutes = m;
  if (t !== undefined) out.maxTasks = t;
  if (k !== undefined) out.maxTokens = k;
  return out;
}

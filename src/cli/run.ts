import { relative } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { nodeProcessPort, type ProcessPort } from "./run-process.js";
import { buildLaunchPlan, laneOpenTasks, nextRunId } from "./run-plan.js";
import { emitScripts } from "./run-script.js";
import { fleetSettings, loadConfig, type FleetSettings } from "../core/config.js";
import { primaryRoot } from "../core/checkouts.js";
import { refusals, type LaunchEntry } from "../core/run-launch-plan.js";
import { laneRefs, type LaneRef } from "../core/query.js";
import { RUNNERS, type RunnerSpec } from "../core/runners.js";
import { resolveBudgets, type Budgets } from "../core/run-supervise.js";
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
}

export class RunCommand extends BaseCommand {
  readonly name = "run";
  readonly summary = "(experimental) Run a feature's prepared lanes headless: print, launch, supervise, merge.";
  readonly usage =
    "ambykit run <feature> [--yes] [--emit-script] [--assistant=<id,id>] [--unattended] [--max-minutes=N] [--max-tasks=N] [--max-tokens=N] [--continue-run=<run>] [--json] | --runners | approve|reject <run> [--reason=<text>]";

  protected readonly deps: RunDeps;

  constructor(deps: Partial<RunDeps> = {}) {
    super();
    this.deps = { ...realDeps(), ...deps };
  }

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const [first, second] = opts.positionals;

    if (flag(opts, "runners")) return this.listRunnerRows(opts);
    if (first && (SUBCOMMANDS as readonly string[]).includes(first)) return this.gate(root, first as (typeof SUBCOMMANDS)[number], second, opts);

    if (!first) {
      this.error("Missing feature.", `Usage: ${this.usage}`);
      return 1;
    }
    const feature = featureDirOf(root, first);
    if (!feature) {
      this.error(`Feature '${first}' not found.`, "Use a feature number or directory name from specs/.");
      return 1;
    }
    if (!flag(opts, "json")) this.warn(EXPERIMENTAL_NOTE);

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
    const run = nextRunId(root, feature);
    const budgets = resolveBudgets({
      openTasks: lanes.reduce((n, l) => n + laneOpenTasks(l).length, 0),
      config: settings.budgets,
      flags: budgetFlags(opts),
    });
    const plan = buildLaunchPlan({ root, feature, lanes, assistants, run, settings, registry: this.deps.registry });
    const ctx: RunContext = { root, feature, lanes, assistants, run, settings, budgets, unattended: flag(opts, "unattended"), plan, opts };
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

  /** Filled in by US-2: create the run, start the lanes and supervise them. */
  protected async launch(_ctx: RunContext): Promise<number> {
    return 0;
  }

  private refuse(refused: { lane: string; assistant: string; reason: string }[], json: boolean): number {
    if (!json) for (const r of refused) this.error(`${r.lane} (${r.assistant}): ${r.reason}`);
    this.error("Nothing was launched: every lane needs a verified runner (see `ambykit run --runners`).");
    return 1;
  }

  private printPlan(ctx: RunContext): void {
    const { settings, budgets } = ctx;
    this.info(`Run plan for ${ctx.feature} — run ${ctx.run} (experimental)`);
    this.info(
      `Lanes: ${ctx.lanes.length} · assistants: ${[...new Set(ctx.plan.map((e) => e.assistant))].join(", ")} · caps: ${settings.concurrency.total} at once, ${settings.concurrency.perType} per assistant`,
    );
    const tokens = budgets.maxTokens !== undefined ? `, ${budgets.maxTokens} tokens` : "";
    this.info(`Budgets: ${budgets.wallClockMinutes} minutes wall-clock, ${budgets.maxTasks} task events${tokens}`);
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
      experimental: true,
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

  protected listRunnerRows(_opts: CliOptions): number {
    for (const r of this.deps.registry) this.info(`${r.id}\t${r.verified ? "verified" : "unverified"}`);
    return 0;
  }

  protected async gate(_root: string, _verb: (typeof SUBCOMMANDS)[number], _run: string | undefined, _opts: CliOptions): Promise<number> {
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

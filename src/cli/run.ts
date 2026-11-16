import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { fleetSettings, loadConfig } from "../core/config.js";
import { laneRefs, type LaneRef } from "../core/query.js";
import { RUNNERS } from "../core/runners.js";
import { featureDirOf } from "../core/tasks-edit.js";
import { primaryRoot } from "../core/checkouts.js";

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

export class RunCommand extends BaseCommand {
  readonly name = "run";
  readonly summary = "(experimental) Run a feature's prepared lanes headless: print, launch, supervise, merge.";
  readonly usage =
    "ambykit run <feature> [--yes] [--emit-script] [--assistant=<id,id>] [--unattended] [--max-minutes=N] [--max-tasks=N] [--max-tokens=N] [--continue-run=<run>] [--json] | --runners | approve|reject <run> [--reason=<text>]";

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

  /** Filled in by the story tasks that follow (preview, launch, supervise). */
  protected async start(_root: string, _feature: string, _lanes: LaneRef[], _opts: CliOptions): Promise<number> {
    return 0;
  }

  protected listRunnerRows(_opts: CliOptions): number {
    for (const r of RUNNERS) this.info(`${r.id}\t${r.verified ? "verified" : "unverified"}`);
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

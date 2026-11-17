import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { featureRefOf } from "../core/dashboard.js";
import { findProjectRoot } from "../core/paths.js";
import { reportActivity } from "../core/report.js";
import { featureIds } from "../core/worktree.js";

/**
 * `ambykit activity` — an assistant records that it started a phase (feature 017, FR-018/FR-020). The
 * phase prompts run it as one line with their failures ignored, and it never fails the agent either:
 * every problem is a warning on stderr and exit 0. Writes `.amby/activity/<feature>.<agent>.json` in
 * the checkout it runs from, so a worktree carries its own marker.
 *
 * Feature 025 (FR-021): `--lane`, `--state` and `--run` add a lane to the file name and the fleet fields
 * to the marker; it is the same core writer the `report_activity` tool calls. Without those flags the
 * marker is byte-for-byte what it was.
 */
export class ActivityCommand extends BaseCommand {
  readonly name = "activity";
  readonly summary = "Record that an assistant is working on a feature (used by the phase prompts).";
  readonly usage =
    "ambykit activity <feature> --agent=<tool-id> --phase=<phase> [--task=T###] [--lane=<lane>] [--state=working|waiting|blocked|paused|done] [--run=<id>]";
  protected override requiresProject = false;

  protected async execute(opts: CliOptions): Promise<number> {
    const root = findProjectRoot(opts.cwd);
    const arg = opts.positionals[0];
    const agent = stringFlag(opts, "agent");
    const phase = stringFlag(opts, "phase");
    if (!root) return this.skip("not inside an AmbyKit project");
    if (!arg || !agent || !phase) return this.skip(`usage: ${this.usage}`);
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(agent)) return this.skip(`invalid agent id '${agent}'`);

    const ids = featureIds(root);
    const feature = ids.find((id) => id === arg) ?? ids.find((id) => featureRefOf(id) === arg);
    if (!feature) return this.skip(`feature '${arg}' not found`);

    const task = stringFlag(opts, "task");
    const lane = stringFlag(opts, "lane");
    const state = stringFlag(opts, "state");
    const run = stringFlag(opts, "run");
    const result = reportActivity(root, {
      feature,
      agent,
      phase,
      ...(task ? { task } : {}),
      ...(lane ? { lane } : {}),
      ...(state ? { state } : {}),
      ...(run ? { run } : {}),
      pid: process.ppid,
      fleet: Boolean(lane || state || run), // a plain call looks nothing up, as before
    });
    if (!result.ack || result.warning) this.warn(`activity ${result.ack ? "recorded with a warning" : "not recorded"}: ${result.warning ?? "unknown problem"}`);
    return 0;
  }

  /** Warn and succeed: a missing marker only costs the dashboard a presence row. */
  private skip(reason: string): number {
    this.warn(`activity not recorded: ${reason}`);
    return 0;
  }
}

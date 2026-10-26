import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { writeMarker } from "../core/activity.js";
import { featureRefOf } from "../core/dashboard.js";
import { findProjectRoot } from "../core/paths.js";
import { featureIds } from "../core/worktree.js";

/**
 * `ambykit activity` — an assistant records that it started a phase (feature 017, FR-018/FR-020). The
 * phase prompts run it as one line with their failures ignored, and it never fails the agent either:
 * every problem is a warning on stderr and exit 0. Writes `.amby/activity/<feature>.<agent>.json` in
 * the checkout it runs from, so a worktree carries its own marker.
 */
export class ActivityCommand extends BaseCommand {
  readonly name = "activity";
  readonly summary = "Record that an assistant is working on a feature (used by the phase prompts).";
  readonly usage = "ambykit activity <feature> --agent=<tool-id> --phase=<phase> [--task=T###]";
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
    try {
      writeMarker(root, { feature, agent, phase, ...(task ? { task } : {}), at: new Date().toISOString(), pid: process.ppid });
    } catch (err) {
      return this.skip((err as Error).message.split("\n")[0] ?? "could not write the marker");
    }
    return 0;
  }

  /** Warn and succeed: a missing marker only costs the dashboard a presence row. */
  private skip(reason: string): number {
    this.warn(`activity not recorded: ${reason}`);
    return 0;
  }
}

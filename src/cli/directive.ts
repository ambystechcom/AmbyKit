import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { writeDirective } from "../core/fleet/directives.js";
import type { DirectiveAction } from "../core/fleet/types.js";
import { findProjectRoot } from "../core/paths.js";
import { featureDirOf } from "../core/tasks-edit.js";

/**
 * `ambykit directive <feature> <lane> pause|resume|stop [--run=<id>]` — steer one lane of a fleet run from
 * the terminal (feature 025, US-7). The same single core writer the dashboard and the prompts call
 * (`writeDirective`, FR-023): `resume` writes `continue`, the last write wins, and a lane that does not exist
 * is refused by name. The worker obeys at its next report; nothing here stops a process.
 */
const VERBS: Record<string, DirectiveAction> = { pause: "pause", resume: "continue", stop: "stop" };

export class DirectiveCommand extends BaseCommand {
  readonly name = "directive";
  readonly summary = "Tell a fleet lane to pause, resume or stop (it obeys at its next report).";
  readonly usage = "ambykit directive <feature> <lane> pause|resume|stop [--run=<id>]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = findProjectRoot(opts.cwd) ?? opts.cwd;
    const [featureArg, laneArg, verb] = opts.positionals;
    if (!featureArg || !laneArg || !verb) {
      this.error("Missing arguments.", `Usage: ${this.usage}`);
      return 1;
    }
    const action = VERBS[verb];
    if (!action) {
      this.error(`Unknown directive '${verb}'.`, "Use pause, resume or stop.");
      return 1;
    }
    const feature = featureDirOf(root, featureArg);
    if (!feature) {
      this.error(`Feature '${featureArg}' not found.`, "Use a feature number or directory name from specs/.");
      return 1;
    }
    const run = stringFlag(opts, "run");
    const out = writeDirective(root, { feature, lane: laneArg, action, ...(run ? { run } : {}) });
    if (!out.ok) {
      this.error(out.error);
      return 1;
    }
    this.success(`${verb} sent to ${out.lane} of ${out.run}; the worker obeys at its next report.`);
    return 0;
  }
}

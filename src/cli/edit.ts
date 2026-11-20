import { join } from "node:path";
import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { featureDirOf } from "../core/tasks-edit.js";
import { withLock } from "../core/fleet/lock.js";
import { applyEdit, setStoryStatus, setTaskFiles, setVerifyResult, type EditOutcome } from "../core/spec-format/write.js";

/**
 * The writer (feature 030, US-10): set a task's files, a phase's Verify result or a story's status in the right place for
 * the file's format, so nobody hand-edits YAML. One line of output; a refusal says why and changes nothing. The same
 * command edits a 1.x file (trailing group, result suffix, status bullet) and a v2 file (phase block, verify block,
 * frontmatter), so the prompts need no format branch. Local, zero model tokens; it takes the same per-file lock as the
 * MCP tick and status tools.
 */
export class EditCommand extends BaseCommand {
  readonly name = "edit";
  readonly summary = "Set a task's files, a phase's Verify result or a story's status without hand-editing the file.";
  readonly usage =
    "ambykit edit files <feature> <T###> <path…> | edit verify <feature> <phase> --result=passed|failed|unverified [--why=<text>] | edit status <feature> <US-#> <status>";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const [verb, featureRef, ...rest] = opts.positionals;
    if (!verb || !featureRef) {
      this.error("Missing arguments.", `Usage: ${this.usage}`);
      return 1;
    }
    const feature = featureDirOf(root, featureRef);
    if (!feature) {
      this.error(`feature '${featureRef}' not found`, "Use a feature number or directory name, e.g. `ambykit edit status 030 US-2 done`.");
      return 1;
    }

    let outcome: EditOutcome;
    if (verb === "files") {
      const [task, ...paths] = rest;
      if (!task) return this.usageError("edit files <feature> <T###> <path…>");
      outcome = this.locked(root, `tasks-${feature}`, join(root, "specs", feature, "tasks.md"), (text) => setTaskFiles(text, task, paths));
    } else if (verb === "verify") {
      const [phaseArg] = rest;
      const phase = Number(/(\d+)/.exec(phaseArg ?? "")?.[1]);
      const result = stringFlag(opts, "result");
      if (!phaseArg || !Number.isFinite(phase) || !result) return this.usageError("edit verify <feature> <phase> --result=passed|failed|unverified [--why=<text>]");
      const why = stringFlag(opts, "why") ?? "";
      outcome = this.locked(root, `tasks-${feature}`, join(root, "specs", feature, "tasks.md"), (text) => setVerifyResult(text, phase, result, why));
    } else if (verb === "status") {
      const [story, status] = rest;
      if (!story || !status) return this.usageError("edit status <feature> <US-#> <status>");
      outcome = this.locked(root, `spec-${feature}`, join(root, "specs", feature, "spec.md"), (text) => setStoryStatus(text, feature, story, status));
    } else {
      return this.usageError(this.usage);
    }

    if (!outcome.ok) {
      this.error(outcome.error);
      return 1;
    }
    this.info(outcome.summary);
    return 0;
  }

  private usageError(usage: string): number {
    this.error("Missing or invalid arguments.", `Usage: ambykit ${usage}`);
    return 1;
  }

  /** Apply an edit to a file under the per-file lock the MCP edit tools use. */
  private locked(root: string, lockName: string, file: string, edit: (text: string) => EditOutcome): EditOutcome {
    const held = withLock(root, lockName, () => applyEdit(file, edit));
    return held.ok ? held.value : { ok: false, error: held.warning };
  }
}

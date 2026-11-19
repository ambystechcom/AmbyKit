import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { migrateProject } from "../core/migrate/run.js";
import { unifiedDiff } from "../core/migrate/summary.js";

/** The sentence every migrate run that converts something prints (030:FR-025, 026:R-1). */
export const LOSS_NOTICE =
  "A 1.x AmbyKit reads a v2 file without an error but loses story statuses, dependencies, file ownership and Verify results. " +
  "Upgrade every tool that reads these specs before you commit the migrated files, or use --dual-write while some still run 1.x.";

/**
 * Convert the 1.x spec.md and tasks.md files of this checkout to the v2 format (feature 030). Local, zero model tokens,
 * non-destructive by construction: a file that is not provably safe is left untouched and listed with the fix, every
 * conversion is read back before it is written, each file is written once (temp file, then rename), and a second run
 * changes nothing. `--dry-run` writes nothing and prints what would change; `--diff` adds each unified diff.
 */
export class MigrateCommand extends BaseCommand {
  readonly name = "migrate";
  readonly summary = "Convert 1.x specs and task lists to the v2 format, safely (--dry-run, --diff, --dual-write).";
  readonly usage = "ambykit migrate [feature] [--dry-run] [--diff] [--dual-write]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const dryRun = flag(opts, "dry-run");
    const feature = opts.positionals[0];
    const result = migrateProject(root, {
      dryRun,
      dualWrite: flag(opts, "dual-write"),
      ...(feature !== undefined ? { feature } : {}),
    });

    if (feature !== undefined && result.records.length === 0) {
      this.error(`No feature matches "${feature}".`, "Use a feature number or directory name, e.g. `ambykit migrate 023`.");
      return 1;
    }

    if (result.dirty.length > 0) {
      this.warn(`These files had uncommitted changes and were migrated anyway: ${result.dirty.join(", ")}. Review them with git diff.`);
    }

    this.info(result.summary);
    if (flag(opts, "diff")) {
      for (const r of result.records) {
        if (r.status !== "converted" || r.before === undefined || r.after === undefined) continue;
        const d = unifiedDiff(`specs/${r.feature}/${r.file}`, r.before, r.after);
        if (d) this.info(`\n${d}`);
      }
    }

    const plan = result.config.plan;
    if (plan.action === "write") {
      this.info(`\nConfig: ${dryRun ? "would add" : result.config.written ? "added" : "could not add"} schemaVersion ${plan.to} to .amby/config.json (every setting kept).`);
    } else if (plan.action === "refuse") {
      this.warn(`Config: ${plan.reason}`);
    }

    if (result.counts.converted > 0) {
      this.info(`\n${LOSS_NOTICE}`);
      if (flag(opts, "dual-write")) this.info("Dual-write files are transitional: they carry both formats. Run migrate without --dual-write once every tool is on 2.x.");
    }
    if (result.counts.skipped > 0) {
      this.warn(`${result.counts.skipped} file(s) were left untouched. Apply the fix named for each, then run migrate again.`);
    }
    if (result.counts.converted === 0 && result.counts.skipped === 0) this.success("Nothing to migrate: every spec and task file is already v2.");
    return 0;
  }
}

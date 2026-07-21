import { BaseCommand, type CliOptions } from "./base-command.js";
import { listBackups, restoreLatestBackup } from "./io/fsops.js";

/**
 * Recover an agent-doc file that a brownfield init/update modified, from the timestamped backups
 * AmbyKit writes under `.amby/backups/` (US-4 / SC-005). With no argument it lists what can be
 * restored; with a file path it restores that file's most recent backup.
 */
export class RestoreCommand extends BaseCommand {
  readonly name = "restore";
  readonly summary = "Restore an agent-doc file from its pre-modification backup.";
  readonly usage = "ambykit restore [file]   # no file → list available backups";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const target = opts.positionals[0];
    const backups = listBackups(root);

    if (backups.length === 0) {
      this.warn("No backups found under .amby/backups/.");
      return 0;
    }

    if (!target) {
      this.info("Backups available to restore (newest first):");
      // One line per original file, showing its most recent backup.
      const seen = new Set<string>();
      for (const b of backups) {
        if (seen.has(b.original)) continue;
        seen.add(b.original);
        this.info(`  ${b.original}  ←  ${b.backup}`);
      }
      this.info("Run `ambykit restore <file>` to restore one.");
      return 0;
    }

    if (this.dryRun) {
      const latest = backups.find((b) => b.original === target.replace(/\\/g, "/"));
      if (!latest) {
        this.error(`No backup found for '${target}'.`);
        return 1;
      }
      this.info(`Would restore ${target} from ${latest.backup}.`);
      return 0;
    }

    const restored = restoreLatestBackup(root, target);
    if (!restored) {
      this.error(`No backup found for '${target}'.`, "Run `ambykit restore` to list available backups.");
      return 1;
    }
    this.success(`Restored ${target} from ${restored.backup}.`);
    return 0;
  }
}

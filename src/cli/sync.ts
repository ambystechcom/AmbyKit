import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { applyFiles } from "./fsops.js";
import { buildEmittedFiles } from "./emit.js";
import { loadConfig } from "../core/config.js";
import { installArtifactTemplates } from "../core/scaffold.js";

export class SyncCommand extends BaseCommand {
  readonly name = "sync";
  readonly summary = "Re-emit all configured tools from the neutral source.";
  readonly usage = "ambykit sync [--check] [--include-user] [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const config = loadConfig(root);
    if (config.tools.length === 0) {
      this.warn("No tools configured. Run `ambykit add <tool>` first.");
      return 0;
    }

    const checkOnly = flag(opts, "check");
    const includeUser = flag(opts, "include-user");

    // Add any newly-introduced templates/reference docs without clobbering user customizations.
    const templates = installArtifactTemplates(root, this.dryRun || checkOnly);
    if (templates.created.length > 0 && !checkOnly) {
      this.info(`${this.dryRun ? "Would install" : "Installed"} ${templates.created.length} new template/reference file(s).`);
    }

    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, {
      dryRun: this.dryRun || checkOnly,
      includeUser,
    });

    if (checkOnly) {
      if (result.wouldChange.length > 0) {
        this.error(`Out of sync: ${result.wouldChange.length} file(s) would change.`);
        for (const p of result.wouldChange) this.info(`  ~ ${p}`);
        return 1;
      }
      this.success(`In sync (${result.unchanged.length} file(s) checked).`);
      return 0;
    }

    const changed = this.dryRun ? result.wouldChange : result.written;
    this.success(`${this.dryRun ? "Would sync" : "Synced"} ${changed.length} file(s); ${result.unchanged.length} unchanged.`);
    for (const p of changed) this.debug(p);
    if (result.skipped.length > 0) {
      this.warn(`${result.skipped.length} user-level file(s) skipped (use --include-user).`);
    }
    return 0;
  }
}

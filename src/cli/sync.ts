import { rmSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { applyFiles, backupFile } from "./io/fsops.js";
import { legacyWorkflowFiles } from "../core/legacy.js";
import { buildEmittedFiles } from "../core/emit.js";
import { loadConfig } from "../core/config.js";
import { installArtifactTemplates } from "../core/scaffold.js";
import { loadRoles, validateRoles } from "../core/roles.js";

export class SyncCommand extends BaseCommand {
  readonly name = "sync";
  readonly summary = "Re-emit all configured tools from the neutral source.";
  readonly usage = "ambykit sync [--check] [--include-user] [--prune-legacy] [--dry-run]";

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

    // Roles (feature 013, FR-010): size is advisory, duplicate ids are not.
    const roles = validateRoles(loadRoles(root));
    for (const w of roles.warnings) this.warn(w);
    if (roles.errors.length > 0) {
      for (const e of roles.errors) this.error(e);
      return 1;
    }

    const spin = this.spinner();
    spin.start(this.dryRun || checkOnly ? "Checking what would change…" : "Emitting tool files…");
    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, {
      dryRun: this.dryRun || checkOnly,
      includeUser,
    });
    spin.stop();

    if (checkOnly) {
      if (result.wouldChange.length > 0) {
        this.error(
          `Out of sync: ${result.wouldChange.length} file(s) would change.`,
          "Run `ambykit sync` to regenerate them.",
        );
        for (const p of result.wouldChange) this.info(`  ~ ${p}`);
        return 1;
      }
      this.success(`In sync (${result.unchanged.length} file(s) checked).`);
      return 0;
    }

    const changed = this.dryRun ? result.wouldChange : result.written;
    this.success(`${this.dryRun ? "Would sync" : "Synced"} ${changed.length} file(s).`);
    this.printSummary(result);
    this.handleLegacyWorkflows(root, legacyWorkflowFiles(root, config), flag(opts, "prune-legacy"));
    return 0;
  }

  /**
   * Stale AmbyKit-generated Antigravity workflows (feature 018, FR-005): left in place and reported by
   * default; with `--prune-legacy` each is backed up under `.amby/backups/` (so `ambykit restore`
   * brings it back) and then removed. Files AmbyKit did not generate never reach this list.
   */
  private handleLegacyWorkflows(root: string, stale: string[], prune: boolean): void {
    if (stale.length === 0) return;
    if (!prune) {
      this.warn(`${stale.length} stale Antigravity workflow file(s) from an earlier release no longer run:`);
      for (const p of stale) this.info(`  ~ ${p}`);
      this.info("  Run `ambykit sync --prune-legacy` to back them up and remove them.");
      return;
    }
    for (const rel of stale) {
      if (this.dryRun) continue;
      const abs = join(root, rel);
      backupFile(root, abs, rel);
      rmSync(abs);
    }
    this.success(`${this.dryRun ? "Would remove" : "Removed"} ${stale.length} stale workflow file(s) (backed up under .amby/backups/; \`ambykit restore <file>\` undoes it).`);
  }
}

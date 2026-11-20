import { rmSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { applyFiles, backupFile } from "./io/fsops.js";
import { legacyWorkflowFiles } from "../core/legacy.js";
import { buildEmittedFiles, mcpUnwritten } from "../core/emit.js";
import { loadConfig } from "../core/config.js";
import { installArtifactTemplates } from "../core/scaffold.js";
import { loadRoles, validateRoles } from "../core/roles.js";
import type { TargetRegistry } from "../plugins/registry.js";
import { deprecatedTargetNotices, movedTargetNotices } from "../core/moved-targets.js";
import { getTarget } from "../emitters/index.js";
import { loadPluginSession } from "../plugins/session.js";
import { reportPlugins } from "../plugins/report.js";

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

    // Plugins (feature 027): only the packages listed in config are loaded, and never when none are listed.
    // A plugin that fails is reported and the other targets still sync, but the run exits 1 (FR-004).
    const session = await loadPluginSession(root, config);
    const plugins = reportPlugins(session);
    for (const line of plugins.info) this.info(line);
    for (const line of plugins.errors) this.error(line);
    // A configured target that moved to a plugin whose package is not installed fails that target only (feature 036,
    // FR-004): say which package to install and how to list it, keep syncing the others, exit 1, and remove nothing (FR-005).
    const movedMissing = movedTargetNotices(config.tools, (id) => getTarget(id, session?.registry) !== undefined);
    for (const notice of movedMissing) this.error(notice);
    // Bundled targets that will move once their plugin is published: a notice only, nothing is removed (feature 036, FR-002, C-4).
    for (const notice of deprecatedTargetNotices(config.tools)) this.warn(notice);
    const pluginStatus = plugins.errors.length > 0 || movedMissing.length > 0 ? 1 : 0;

    const spin = this.spinner();
    spin.start(this.dryRun || checkOnly ? "Checking what would change…" : "Emitting tool files…");
    const files = buildEmittedFiles(root, config, session?.registry);
    const result = applyFiles(root, files, {
      dryRun: this.dryRun || checkOnly,
      includeUser: includeUser && !checkOnly, // user-level files never take part in the in-sync check (025 FR-018)
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
      return pluginStatus;
    }

    const changed = this.dryRun ? result.wouldChange : result.written;
    this.success(`${this.dryRun ? "Would sync" : "Synced"} ${changed.length} file(s).`);
    this.printSummary(result);
    this.printMcpGaps(config, session?.registry);
    this.handleLegacyWorkflows(root, legacyWorkflowFiles(root, config, session?.registry), flag(opts, "prune-legacy"));
    return pluginStatus;
  }

  /** With `mcp.enabled`, say which enabled targets get no MCP config and why (feature 025, FR-018). */
  private printMcpGaps(config: ReturnType<typeof loadConfig>, registry?: TargetRegistry): void {
    const gaps = mcpUnwritten(config, registry);
    if (gaps.length === 0) return;
    this.warn(`MCP server config not written for ${gaps.length} enabled target(s):`);
    for (const g of gaps) this.info(`  ~ ${g.tool}: ${g.reason}`);
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

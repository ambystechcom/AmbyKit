import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./io/fsops.js";
import { buildEmittedFiles } from "../core/emit.js";
import { loadConfig } from "../core/config.js";
import { readFeatures } from "../core/features.js";
import { activeTally, legacyEnabled, legacyFeatures } from "../core/spec-format/legacy.js";
import { getTarget, sharedOutputs } from "../emitters/index.js";
import { defaultBranch, isMerged, isRepo, worktreeList } from "../core/git.js";
import { featureWorktrees } from "../core/worktree.js";
import { ROLES_DIR, loadRoles, validateRoles } from "../core/roles.js";
import { SHIPPED_ROLES } from "../core/scaffold.js";
import { legacyWorkflowFiles } from "../core/legacy.js";
import { deprecatedTargetNotices, movedTarget, movedTargetNotices } from "../core/moved-targets.js";
import { loadPluginSession } from "../plugins/session.js";
import { reportPlugins } from "../plugins/report.js";

export class CheckCommand extends BaseCommand {
  readonly name = "check";
  readonly summary = "Verify the AmbyKit setup and report drift from the neutral source.";
  readonly usage = "ambykit check";

  /** `check` lists the 1.x features itself (below), so the shared one-line warning is off. */
  protected override get showsLegacyWarning(): boolean {
    return false;
  }

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    let ok = true;

    if (!existsSync(join(root, ".amby", "constitution.md"))) {
      this.warn("Missing .amby/constitution.md — run /amby.constitution.");
      ok = false;
    }

    const config = loadConfig(root);
    if (config.tools.length === 0) {
      this.warn("No tools configured.");
      ok = false;
    }
    // Plugins (feature 027): a plugin that fails to load, or a target it cannot register, is drift.
    const session = await loadPluginSession(root, config);
    const plugins = reportPlugins(session);
    for (const line of plugins.info) this.info(`  ${line}`);
    for (const line of plugins.errors) {
      this.warn(line);
      ok = false;
    }
    const registry = session?.registry;
    // A moved target with no plugin is drift for that target (feature 036, FR-004): the notice names the package to install.
    for (const notice of movedTargetNotices(config.tools, (id) => getTarget(id, registry) !== undefined)) {
      this.warn(notice);
      ok = false;
    }
    // Bundled targets that will move once their plugin is published: a notice only, nothing is removed (feature 036, FR-002, C-4).
    for (const notice of deprecatedTargetNotices(config.tools)) this.warn(notice);
    for (const t of config.tools) {
      if (!getTarget(t, registry) && !movedTarget(t)) {
        this.warn(`Configured tool '${t}' is not a known target.`);
        ok = false;
      }
    }

    // Roles (feature 013, FR-011): report validation problems and shipped defaults that were removed.
    const roles = loadRoles(root);
    if (roles.length > 0) {
      const v = validateRoles(roles);
      for (const w of v.warnings) this.warn(w);
      for (const e of v.errors) {
        this.warn(e);
        ok = false;
      }
      const missing = SHIPPED_ROLES.filter((f) => !existsSync(join(root, ROLES_DIR, f)));
      if (missing.length > 0) {
        this.warn(`Default role(s) missing from ${ROLES_DIR}: ${missing.join(", ")} — run \`ambykit sync\` to reinstall.`);
      }
    }

    const files = buildEmittedFiles(root, config, registry);
    const result = applyFiles(root, files, { dryRun: true, includeUser: false });
    if (result.skippedForeign.length > 0) {
      this.warn(`${result.skippedForeign.length} file(s) AmbyKit did not generate block its own output:`);
      for (const p of result.skippedForeign) this.info(`  ! ${p}`);
      ok = false;
    }
    if (result.wouldChange.length > 0) {
      this.warn(`${result.wouldChange.length} generated file(s) are out of sync — run \`ambykit sync\`.`);
      for (const p of result.wouldChange) this.info(`  ~ ${p}`);
      ok = false;
    }

    // Targets that share one emitter write the same files once (feature 016, FR-007); name the owners.
    for (const s of sharedOutputs(config.tools, registry)) {
      this.info(`  Shared output ${s.dir}/ is owned by: ${s.owners.join(", ")}.`);
    }

    // Stale generated Antigravity workflows (feature 018, FR-007): informational, never drift.
    const stale = legacyWorkflowFiles(root, config, registry);
    if (stale.length > 0) {
      this.warn(`${stale.length} stale Antigravity workflow file(s) no longer run — \`ambykit sync --prune-legacy\` removes them (backed up).`);
      for (const p of stale) this.info(`  ~ ${p}`);
    }

    // Stale feature worktrees (feature 012, FR-013): branch already merged into the default branch.
    for (const id of staleWorktrees(root)) {
      this.warn(`Worktree .worktrees/${id} is merged — run \`ambykit worktree remove ${id}\`.`);
    }

    // Feature 030 (US-6): features still on the 1.x spec format, as a notice. It never changes the exit status.
    if (legacyEnabled(config)) {
      readFeatures(root);
      const old = legacyFeatures(activeTally());
      if (old.length > 0) {
        this.info(`Notice: ${old.length} feature${old.length === 1 ? "" : "s"} still use${old.length === 1 ? "s" : ""} the 1.x spec format (read as before): ${old.join(", ")}. Run \`ambykit migrate --dry-run\` to preview; support ends in 2.1.`);
      }
    }

    if (ok) {
      this.success(`Healthy: ${config.tools.join(", ")} · ${result.unchanged.length} file(s) in sync.`);
      return 0;
    }
    return 1;
  }
}

/** Feature worktrees whose branch is already merged into the default branch (never fails `check`). */
export function staleWorktrees(root: string): string[] {
  if (!isRepo(root)) return [];
  try {
    const base = defaultBranch(root);
    if (!base) return [];
    return featureWorktrees(root, worktreeList(root))
      .filter(({ worktree: w }) => w.branch && w.branch !== base && isMerged(root, w.branch, base))
      .map((x) => x.feature);
  } catch {
    return [];
  }
}

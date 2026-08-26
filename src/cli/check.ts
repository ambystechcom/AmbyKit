import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./io/fsops.js";
import { buildEmittedFiles } from "../core/emit.js";
import { loadConfig } from "../core/config.js";
import { getTarget } from "../emitters/index.js";
import { defaultBranch, isMerged, isRepo, worktreeList } from "../core/git.js";
import { featureWorktrees } from "../core/worktree.js";
import { ROLES_DIR, loadRoles, validateRoles } from "../core/roles.js";
import { SHIPPED_ROLES } from "../core/scaffold.js";

export class CheckCommand extends BaseCommand {
  readonly name = "check";
  readonly summary = "Verify the AmbyKit setup and report drift from the neutral source.";
  readonly usage = "ambykit check";

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
    for (const t of config.tools) {
      if (!getTarget(t)) {
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

    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, { dryRun: true, includeUser: false });
    if (result.wouldChange.length > 0) {
      this.warn(`${result.wouldChange.length} generated file(s) are out of sync — run \`ambykit sync\`.`);
      for (const p of result.wouldChange) this.info(`  ~ ${p}`);
      ok = false;
    }

    // Stale feature worktrees (feature 012, FR-013): branch already merged into the default branch.
    for (const id of staleWorktrees(root)) {
      this.warn(`Worktree .worktrees/${id} is merged — run \`ambykit worktree remove ${id}\`.`);
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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { renderTable } from "./ui/table.js";
import {
  branchExists,
  defaultBranch,
  git,
  isDirty,
  isMerged,
  isRepo,
  worktreeList,
} from "../core/git.js";
import {
  WORKTREES_DIR,
  ensureGitignore,
  featureIds,
  featureWorktrees,
  findWorktree,
  planCreate,
  planRemove,
  type WorktreeStatus,
} from "../core/worktree.js";

/**
 * `ambykit worktree` — per-feature git worktrees under `.worktrees/<feature>` so several features
 * can be worked on in parallel without checkout switching (feature 012). Zero model tokens; all
 * decisions are pure (`core/worktree.ts`), this class only performs them.
 */
export class WorktreeCommand extends BaseCommand {
  readonly name = "worktree";
  readonly summary = "Create, list, or remove an isolated working copy for a feature.";
  readonly usage = "ambykit worktree <feature> | list | remove <feature> [--force] [--json] [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const json = flag(opts, "json");
    const [sub, arg] = opts.positionals;

    if (!isRepo(root)) {
      this.error("Not a git repository — worktrees need git.", "Run `git init` and commit first.");
      return 1;
    }

    if (sub === "list") return this.list(root, json);
    if (sub === "remove") {
      if (!arg) {
        this.error("Usage: ambykit worktree remove <feature> [--force]");
        return 1;
      }
      return this.remove(root, arg, flag(opts, "force"), json);
    }
    if (!sub) {
      this.error("Usage: " + this.usage);
      return 1;
    }
    return this.create(root, sub, json);
  }

  // --- create (US-1) ---
  private create(root: string, feature: string, json: boolean): number {
    const plan = planCreate({
      root,
      featureId: feature,
      features: featureIds(root),
      worktrees: worktreeList(root),
      branchExists: branchExists(root, feature),
      defaultBranch: defaultBranch(root),
      dirExists: existsSync(join(root, WORKTREES_DIR, feature)),
    });

    if (plan.action === "refuse") {
      this.error(plan.reason);
      return 1;
    }
    if (plan.action === "exists") {
      if (json) console.log(JSON.stringify({ action: "exists", feature, path: plan.path }));
      else this.success(`Worktree for ${feature} already exists at ${rel(root, plan.path)}`);
      return 0;
    }

    const ignoreChanged = this.ensureIgnore(root);
    const args = plan.newBranch
      ? ["worktree", "add", "-b", plan.branch, plan.path, plan.base as string]
      : ["worktree", "add", plan.path, plan.branch];

    if (this.dryRun) {
      this.info(`[dry-run] would run: git ${args.join(" ")}`);
      if (ignoreChanged) this.info(`[dry-run] would add ${WORKTREES_DIR}/ to .gitignore`);
      return 0;
    }
    git(root, args);
    if (json) {
      console.log(JSON.stringify({ action: "created", feature, path: plan.path, branch: plan.branch, newBranch: plan.newBranch, base: plan.base }));
    } else {
      const how = plan.newBranch ? `new branch ${plan.branch} from ${plan.base}` : `existing branch ${plan.branch}`;
      this.success(`Created ${rel(root, plan.path)} (${how})`);
      this.info(`  cd ${rel(root, plan.path)} and continue with /amby.* there.`);
    }
    return 0;
  }

  /** Add `.worktrees/` to .gitignore (FR-002). Returns whether a change was (or would be) needed. */
  private ensureIgnore(root: string): boolean {
    const path = join(root, ".gitignore");
    const before = existsSync(path) ? readFileSync(path, "utf8") : "";
    const { text, changed } = ensureGitignore(before);
    if (changed && !this.dryRun) writeFileSync(path, text, "utf8");
    return changed;
  }

  // --- list (US-2) ---
  private statuses(root: string): WorktreeStatus[] {
    const base = defaultBranch(root);
    return featureWorktrees(root, worktreeList(root)).map(({ feature, worktree }) => ({
      feature,
      branch: worktree.branch,
      path: worktree.path,
      dirty: existsSync(worktree.path) ? isDirty(worktree.path) : false,
      stale: !!(base && worktree.branch && worktree.branch !== base && isMerged(root, worktree.branch, base)),
    }));
  }

  private list(root: string, json: boolean): number {
    const rows = this.statuses(root);
    if (json) {
      console.log(JSON.stringify(rows));
      return 0;
    }
    if (rows.length === 0) {
      this.info(`No feature worktrees. Create one with \`ambykit worktree <feature>\`.`);
      return 0;
    }
    const columns = [
      { header: "Feature", min: 7, priority: 100 },
      { header: "Branch", min: 6, priority: 60 },
      { header: "State", min: 5, priority: 90 },
      { header: "Path", min: 8, priority: 40 },
    ];
    const table = rows.map((r) => [
      r.feature,
      r.branch ?? "(detached)",
      r.dirty ? "dirty" : r.stale ? "clean · merged" : "clean",
      rel(root, r.path),
    ]);
    this.info(renderTable(this.caps, { columns, rows: table, width: this.caps.columns }));
    return 0;
  }

  // --- remove (US-2) ---
  private remove(root: string, feature: string, force: boolean, json: boolean): number {
    const worktrees = worktreeList(root);
    const existing = findWorktree(root, feature, worktrees);
    const dirty = existing && existsSync(existing.path) ? isDirty(existing.path) : false;
    const plan = planRemove({ root, featureId: feature, worktrees, dirty, force });

    if (plan.action === "absent") {
      if (json) console.log(JSON.stringify({ action: "absent", feature }));
      else this.info(`No worktree for ${feature} — nothing to remove.`);
      return 0;
    }
    if (plan.action === "refuse") {
      this.error(`${rel(root, plan.path)} ${plan.reason}`);
      return 1;
    }
    const args = ["worktree", "remove", ...(plan.force ? ["--force"] : []), plan.path];
    if (this.dryRun) {
      this.info(`[dry-run] would run: git ${args.join(" ")}`);
      return 0;
    }
    git(root, args);
    if (json) console.log(JSON.stringify({ action: "removed", feature, path: plan.path }));
    else this.success(`Removed ${rel(root, plan.path)} (branch ${feature} kept)`);
    return 0;
  }
}

function rel(root: string, path: string): string {
  const r = relative(root, path);
  return r === "" ? "." : r.replace(/\\/g, "/");
}

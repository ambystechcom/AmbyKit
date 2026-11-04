import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { renderTable } from "./ui/table.js";
import { loadConfig } from "../core/config.js";
import { parseTasks, type TaskLine } from "../core/dashboard.js";
import { branchExists, git, gitWithInput, isDirty, isMerged, isRepo, worktreeList } from "../core/git.js";
import {
  describeConflict,
  laneState,
  manifestDrift,
  matchLane,
  mergeCheckoffs,
  planLanes,
  readManifest,
  writeManifest,
  type LaneManifest,
} from "../core/lanes.js";
import {
  WORKTREES_DIR,
  ensureGitignore,
  featureIds,
  findWorktree,
  laneWorktrees,
  samePath,
} from "../core/worktree.js";

/**
 * `ambykit lane` — conflict-free parallel lanes (feature 015). A lane is a worktree + branch
 * `NNN-slug.lane-<phase>-<k>` holding one disjoint group of a phase's `[P]` tasks. All decisions are
 * pure (`core/lanes.ts`); this class only runs git. Zero model tokens.
 */
export class LaneCommand extends BaseCommand {
  readonly name = "lane";
  readonly summary = "Split a phase's parallel tasks into isolated lanes, then merge them back.";
  readonly usage =
    "ambykit lane <feature> [--phase=N] [--lanes=N] | list [<feature>] | remove <feature> [<lane>] [--force] | merge <feature> [<lane>] [--json] [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const json = flag(opts, "json");
    const [sub, a1, a2] = opts.positionals;

    if (!sub) {
      this.error("Usage: " + this.usage);
      return 1;
    }
    if (!isRepo(root)) {
      this.error("Not a git repository — lanes need git.", "Run `git init` and commit first.");
      return 1;
    }
    if (sub === "list") return this.list(root, a1, json);
    if (sub === "remove") {
      if (!a1) {
        this.error("Usage: ambykit lane remove <feature> [<lane>] [--force]");
        return 1;
      }
      return this.remove(root, a1, a2, flag(opts, "force"), json);
    }
    if (sub === "merge") {
      if (!a1) {
        this.error("Usage: ambykit lane merge <feature> [<lane>]");
        return 1;
      }
      return this.merge(root, a1, a2, json);
    }
    return this.create(root, sub, opts, json);
  }

  // --- create ---
  private create(root: string, feature: string, opts: CliOptions, json: boolean): number {
    if (loadConfig(root).worktrees !== true) {
      this.error(
        'Lanes need worktrees enabled — set `"worktrees": true` in .amby/config.json (or run `ambykit init`).',
      );
      return 1;
    }
    if (!featureIds(root).includes(feature)) {
      const list = featureIds(root).join(", ") || "(none)";
      this.error(`No feature '${feature}' under specs/. Valid: ${list}`);
      return 1;
    }
    const fb = featureBranch(root, feature);
    if (!fb) {
      this.error(`No branch for ${feature} — create it with \`ambykit worktree ${feature}\` first.`);
      return 1;
    }
    const tasks = readFeatureTasks(root, feature, fb);
    if (tasks === null) {
      this.error(`${feature} has no tasks.md — run /amby.tasks first.`);
      return 1;
    }

    const phaseFlag = opts.flags["phase"];
    const lanesFlag = opts.flags["lanes"];
    const plan = planLanes(feature, tasks, {
      phase: typeof phaseFlag === "string" ? Number(phaseFlag) : undefined,
      lanes: typeof lanesFlag === "string" ? Number(lanesFlag) : undefined,
    });

    if (plan.status === "conflict") {
      this.error(`Phase ${plan.phase} has path conflicts — no lanes created:`);
      for (const c of plan.conflicts) this.info(`  ${describeConflict(c)}`);
      return 1;
    }
    if (plan.status !== "planned") {
      const why =
        plan.status === "complete"
          ? `All parallel tasks in phase ${plan.phase} are done — nothing to lane.`
          : "No parallel ([P]) tasks to lane.";
      if (json) console.log(JSON.stringify({ action: plan.status, feature, phase: plan.phase, lanes: [] }));
      else this.info(why);
      return 0;
    }

    this.ensureIgnore(root);
    const worktrees = worktreeList(root);
    const baseHead = git(root, ["rev-parse", fb.branch]);
    const results: { name: string; path: string; action: "created" | "exists"; tasks: string[] }[] = [];

    for (const lane of plan.lanes) {
      const path = join(root, WORKTREES_DIR, lane.name);
      const existing = worktrees.find((w) => samePath(w.path, path));
      const ids = lane.tasks.map((t) => t.id);
      if (existing) {
        results.push({ name: lane.name, path, action: "exists", tasks: ids });
        continue;
      }
      const args = branchExists(root, lane.name)
        ? ["worktree", "add", path, lane.name]
        : ["worktree", "add", "-b", lane.name, path, fb.branch];
      if (this.dryRun) {
        this.info(`[dry-run] would run: git ${args.join(" ")}`);
        results.push({ name: lane.name, path, action: "created", tasks: ids });
        continue;
      }
      git(root, args);
      const manifest: LaneManifest = {
        version: 1,
        feature,
        phase: plan.phase,
        lane: lane.name,
        base: fb.branch,
        baseHead,
        tasks: lane.tasks,
      };
      writeManifest(path, manifest);
      results.push({ name: lane.name, path, action: "created", tasks: ids });
    }

    if (json) {
      console.log(JSON.stringify({ action: "planned", feature, phase: plan.phase, lanes: results, stays: plan.stays }));
      return 0;
    }
    for (const r of results) {
      const verb = r.action === "exists" ? "Exists " : this.dryRun ? "Would create" : "Created";
      this.success(`${verb} ${rel(root, r.path)} — ${r.tasks.join(", ")}`);
    }
    if (plan.stays.length > 0) this.info(`  Stay in the feature checkout: ${plan.stays.join(", ")}`);
    this.info("  Work each lane with /amby.implement inside its directory, then `ambykit lane merge " + feature + "`.");
    return 0;
  }

  private ensureIgnore(root: string): void {
    const path = join(root, ".gitignore");
    const before = existsSync(path) ? readFileSync(path, "utf8") : "";
    const { text, changed } = ensureGitignore(before);
    if (changed && !this.dryRun) writeFileSync(path, text, "utf8");
  }

  // --- list ---
  private views(root: string, only?: string) {
    const worktrees = worktreeList(root);
    const out = [];
    for (const l of laneWorktrees(root, worktrees)) {
      if (only && l.feature !== only) continue;
      const manifest = readManifest(l.worktree.path);
      const fb = featureBranch(root, l.feature);
      const own = readTasksFile(l.worktree.path, l.feature) ?? [];
      const ids = manifest?.tasks.map((t) => t.id) ?? [];
      const mine = own.filter((t) => ids.includes(t.id));
      const featureTasks = fb ? readFeatureTasks(root, l.feature, fb) : null;
      const tip = l.worktree.head;
      const dirty = existsSync(l.worktree.path) ? isDirty(l.worktree.path) : false;
      const state = laneState({
        dirty,
        tip,
        baseHead: manifest?.baseHead,
        mergedIntoFeature: !!(fb && isMerged(root, l.name, fb.branch)),
      });
      out.push({
        feature: l.feature,
        name: l.name,
        phase: l.phase,
        index: l.index,
        path: l.worktree.path,
        tasks: ids,
        paths: Array.from(new Set(manifest?.tasks.flatMap((t) => t.paths) ?? [])),
        done: mine.filter((t) => t.done).length,
        total: ids.length,
        state,
        drift: manifest && featureTasks ? manifestDrift(manifest, featureTasks) : [],
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  private list(root: string, feature: string | undefined, json: boolean): number {
    const rows = this.views(root, feature);
    if (json) {
      console.log(JSON.stringify(rows));
      return 0;
    }
    if (rows.length === 0) {
      this.info("No lanes. Create them with `ambykit lane <feature>`.");
      return 0;
    }
    const columns = [
      { header: "Lane", min: 8, priority: 100 },
      { header: "Tasks", min: 5, priority: 90 },
      { header: "Done", min: 4, priority: 80 },
      { header: "State", min: 5, priority: 95 },
      { header: "Paths", min: 8, priority: 40 },
    ];
    const table = rows.map((r) => [
      r.name,
      r.tasks.join(", "),
      `${r.done}/${r.total}`,
      r.drift.length > 0 ? `${r.state} · drift ${r.drift.join(", ")}` : r.state,
      r.paths.join(", "),
    ]);
    this.info(renderTable(this.caps, { columns, rows: table, width: this.caps.columns }));
    return 0;
  }

  // --- remove ---
  private remove(root: string, feature: string, laneArg: string | undefined, force: boolean, json: boolean): number {
    const lanes = laneWorktrees(root, worktreeList(root)).filter((l) => l.feature === feature);
    let targets = lanes;
    if (laneArg) {
      const name = matchLane(feature, lanes.map((l) => l.name), laneArg);
      if (!name) {
        this.error(`No lane '${laneArg}' for ${feature}. Lanes: ${lanes.map((l) => l.name).join(", ") || "(none)"}`);
        return 1;
      }
      targets = lanes.filter((l) => l.name === name);
    }
    if (targets.length === 0) {
      if (json) console.log(JSON.stringify({ action: "absent", feature }));
      else this.info(`No lanes for ${feature} — nothing to remove.`);
      return 0;
    }
    let code = 0;
    const removed: string[] = [];
    for (const l of targets) {
      const dirty = existsSync(l.worktree.path) ? isDirty(l.worktree.path) : false;
      if (dirty && !force) {
        this.error(`${rel(root, l.worktree.path)} has uncommitted changes — commit them or pass --force.`);
        code = 1;
        continue;
      }
      const args = ["worktree", "remove", ...(force ? ["--force"] : []), l.worktree.path];
      if (this.dryRun) {
        this.info(`[dry-run] would run: git ${args.join(" ")}`);
        continue;
      }
      git(root, args);
      removed.push(l.name);
      if (!json) this.success(`Removed ${rel(root, l.worktree.path)} (branch ${l.name} kept)`);
    }
    if (json) console.log(JSON.stringify({ action: "removed", feature, lanes: removed }));
    return code;
  }

  // --- merge ---
  private merge(root: string, feature: string, laneArg: string | undefined, json: boolean): number {
    const worktrees = worktreeList(root);
    const fb = featureBranch(root, feature);
    if (!fb || !fb.checkout) {
      this.error(`${feature} is not checked out anywhere — check out its branch (or \`ambykit worktree ${feature}\`) first.`);
      return 1;
    }
    const checkout = fb.checkout;
    if (isDirty(checkout)) {
      this.error(`${rel(root, checkout)} has uncommitted changes — commit or stash them before merging lanes.`);
      return 1;
    }
    const all = laneWorktrees(root, worktrees)
      .filter((l) => l.feature === feature)
      .sort((a, b) => a.name.localeCompare(b.name));
    let lanes = all;
    if (laneArg) {
      const name = matchLane(feature, all.map((l) => l.name), laneArg);
      if (!name) {
        this.error(`No lane '${laneArg}' for ${feature}. Lanes: ${all.map((l) => l.name).join(", ") || "(none)"}`);
        return 1;
      }
      lanes = all.filter((l) => l.name === name);
    }
    if (lanes.length === 0) {
      this.info(`No lanes for ${feature}.`);
      return 0;
    }

    const tasksRel = `specs/${feature}/tasks.md`;
    let code = 0;
    const report: { lane: string; result: "merged" | "nothing" | "dirty" | "conflict"; detail?: string }[] = [];

    for (const l of lanes) {
      if (existsSync(l.worktree.path) && isDirty(l.worktree.path)) {
        report.push({ lane: l.name, result: "dirty", detail: "has uncommitted changes — commit first" });
        code = 1;
        continue;
      }
      if (isMerged(root, l.name, fb.branch)) {
        report.push({ lane: l.name, result: "nothing" });
        continue;
      }
      try {
        git(checkout, ["merge", "--no-ff", "--no-commit", l.name]);
      } catch {
        const unmerged = git(checkout, ["diff", "--name-only", "--diff-filter=U"]).split(/\r?\n/).filter(Boolean);
        const resolved = unmerged.length === 1 && unmerged[0] === tasksRel ? this.resolveCheckoffs(checkout, tasksRel) : false;
        if (!resolved) {
          abortMerge(checkout);
          report.push({
            lane: l.name,
            result: "conflict",
            detail: unmerged.length > 0 ? `conflicts in ${unmerged.join(", ")} — merge it by hand` : "merge failed",
          });
          code = 1;
          continue;
        }
      }
      if (hasMergeHead(checkout)) git(checkout, ["commit", "-q", "-m", `Merge lane ${l.name}`]);
      report.push({ lane: l.name, result: "merged" });
    }

    if (json) {
      console.log(JSON.stringify({ feature, lanes: report }));
      return code;
    }
    for (const r of report) {
      if (r.result === "merged") this.success(`Merged ${r.lane}`);
      else if (r.result === "nothing") this.info(`${r.lane}: nothing to merge`);
      else this.error(`${r.lane}: ${r.detail}`);
    }
    return code;
  }

  /** Auto-resolve a tasks.md conflict that is only about check-offs. False when it is more than that. */
  private resolveCheckoffs(checkout: string, tasksRel: string): boolean {
    const stage = (n: number): string => {
      try {
        return gitWithInput(checkout, ["show", `:${n}:${tasksRel}`], "").toString("utf8");
      } catch {
        return "";
      }
    };
    const merged = mergeCheckoffs(stage(1), stage(2), stage(3));
    if (merged === null) return false;
    writeFileSync(join(checkout, tasksRel), merged, "utf8");
    git(checkout, ["add", tasksRel]);
    return true;
  }
}

function hasMergeHead(cwd: string): boolean {
  try {
    git(cwd, ["rev-parse", "-q", "--verify", "MERGE_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function abortMerge(cwd: string): void {
  try {
    git(cwd, ["merge", "--abort"]);
  } catch {
    /* nothing to abort */
  }
}

/** The feature's branch and (when checked out somewhere) the checkout holding it. */
function featureBranch(root: string, feature: string): { branch: string; checkout: string | null } | null {
  const worktrees = worktreeList(root);
  const wt = findWorktree(root, feature, worktrees);
  if (wt?.branch) return { branch: wt.branch, checkout: wt.path };
  if (!branchExists(root, feature)) return null;
  const holder = worktrees.find((w) => w.branch === feature);
  return { branch: feature, checkout: holder?.path ?? null };
}

function readTasksFile(checkout: string, feature: string): TaskLine[] | null {
  const file = join(checkout, "specs", feature, "tasks.md");
  return existsSync(file) ? parseTasks(readFileSync(file, "utf8")) : null;
}

/** The feature's tasks.md as committed/checked out on its branch; falls back to the main checkout. */
function readFeatureTasks(
  root: string,
  feature: string,
  fb: { branch: string; checkout: string | null },
): TaskLine[] | null {
  if (fb.checkout) {
    const t = readTasksFile(fb.checkout, feature);
    if (t) return t;
  }
  try {
    return parseTasks(gitWithInput(root, ["show", `${fb.branch}:specs/${feature}/tasks.md`], "").toString("utf8"));
  } catch {
    return readTasksFile(root, feature);
  }
}

function rel(root: string, path: string): string {
  const r = relative(root, path);
  return r === "" ? "." : r.replace(/[\\]/g, "/");
}

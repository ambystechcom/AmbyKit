import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { banner } from "./ui/banner.js";
import { readBurndown, scopeOf } from "../core/burndown.js";
import {
  canonicalStoryId,
  computeDashboard,
  displayKey,
  parseTasks,
  type StoryProgress,
  type TaskLine,
} from "../core/dashboard.js";
import { readFeatures } from "../core/features.js";
import type { Burndown, FeatureSnapshot, Filters, ParseIssue } from "../core/overview-types.js";
import { applyFilters, computeOverview } from "../core/overview.js";
import { packageVersion } from "../core/paths.js";
import { maxPeriodsFor } from "./ui/dashboard/burndown-chart.js";
import type { HeaderMeta } from "./ui/dashboard/cards.js";
import { layoutMode } from "./ui/dashboard/layout.js";
import { renderFeatureView, renderOverview } from "./ui/dashboard/render-overview.js";
import { TOKENS } from "./ui/dashboard/tokens.js";
import { progressCell, renderTable, statusCell } from "./ui/table.js";
import type { Cell } from "./ui/types.js";
import { runFullscreen } from "./ui/interactive/fullscreen.js";
import {
  initOverviewTui,
  isOverviewDone,
  reduceOverviewTui,
  renderOverviewTui,
  type OverviewTuiData,
} from "./ui/interactive/overview.js";

/** Periods for the plain series line and for `--json --overview` (a 100-column panel). */
const PLAIN_PERIODS = 12;
const JSON_PERIODS = maxPeriodsFor(100);

export class DashboardCommand extends BaseCommand {
  readonly name = "dashboard";
  readonly summary = "Progress view over the story/task graph.";
  readonly usage =
    "ambykit dashboard [story-id] [--interactive] [--stories] [--next=N] [--json [--overview]] [--status=X] [--feature=X]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const filters: Filters = { feature: stringFlag(opts, "feature"), status: stringFlag(opts, "status") };

    const storyArg = opts.positionals[0];
    if (storyArg) {
      const issues: ParseIssue[] = [];
      const stories = computeDashboard(root, issues);
      this.reportIssues(issues);
      return this.detail(root, stories, storyArg, flag(opts, "json"));
    }

    const upNextCap = this.upNextCap(opts);
    if (upNextCap === null) return 1;

    if (flag(opts, "json")) {
      const stories = this.legacyStories(root, filters);
      if (!flag(opts, "overview")) {
        this.info(JSON.stringify(stories, null, 2));
        return 0;
      }
      this.info(JSON.stringify(this.overviewJson(root, filters, upNextCap, stories), null, 2));
      return 0;
    }

    if (flag(opts, "stories")) {
      const stories = this.legacyStories(root, filters);
      if (stories.length === 0) {
        this.info("No user stories found. Run /amby.specify to create one.");
        return 0;
      }
      this.renderTable(stories);
      return 0;
    }

    // The overview reads through `readFeatures`, which skips unreadable files (FR-014).
    const { features, issues } = readFeatures(root);
    if (filters.feature && applyFilters(features, { feature: filters.feature }).length === 0) {
      this.error(`Feature ${filters.feature} not found.`, "Use its number (e.g. 014) or its directory name.");
      return 1;
    }
    const meta = this.meta(root);
    // Opt-in interactive view — only on a real terminal; otherwise fall back to one-shot (FR-016).
    if (flag(opts, "interactive") && this.caps.isTTY) {
      return this.interactive(root, { features, issues, meta, upNextCap }, filters);
    }

    const plain = layoutMode(this.caps) === "plain";
    const burndown = this.burndown(root, features, filters, plain ? PLAIN_PERIODS : maxPeriodsFor(this.caps.columns));
    const overview = computeOverview(features, filters, { upNextCap }, issues);
    if (filters.feature) {
      const feature = featureInScope(features, filters);
      this.info(renderFeatureView(this.caps, { overview, feature, meta, burndown }));
      return 0;
    }
    this.info(renderOverview(this.caps, { overview, meta, burndown }));
    return 0;
  }

  /** The legacy story list, filtered as `--json` and `--stories` always have been. */
  private legacyStories(root: string, filters: Filters): StoryProgress[] {
    const issues: ParseIssue[] = [];
    let stories = computeDashboard(root, issues);
    this.reportIssues(issues);
    if (filters.status) stories = stories.filter((s) => s.status === filters.status!.toLowerCase());
    if (filters.feature) stories = stories.filter((s) => s.feature === filters.feature);
    return stories;
  }

  /** Name skipped files on stderr, so `--json` stdout stays valid JSON (FR-014). */
  private reportIssues(issues: ParseIssue[]): void {
    for (const i of issues) this.warn(`skipped ${i.file}: ${i.reason}`);
  }

  /** `--next=N` (R-4): a positive integer, else the token default. Prints an error and returns null. */
  private upNextCap(opts: CliOptions): number | null {
    const raw = opts.flags["next"];
    if (raw === undefined) return TOKENS.component["up-next-item"]["max-items"];
    const n = typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isInteger(n) || n < 1) {
      this.error(`--next expects a positive whole number, got '${String(raw)}'.`, "e.g. ambykit dashboard --next=10");
      return null;
    }
    return n;
  }

  private meta(root: string): HeaderMeta {
    const home = homedir();
    const cwd = root.startsWith(home) ? `~${root.slice(home.length)}` : root;
    return { crumb: [], cwd, version: packageVersion() };
  }

  /** Burndown over the filtered features (FR-018/019). */
  private burndown(root: string, features: FeatureSnapshot[], filters: Filters, maxPeriods: number): Burndown {
    const { scope, current } = scopeOf(applyFilters(features, filters), Boolean(filters.status));
    return readBurndown({ root, scope, current, maxPeriods, minPoints: TOKENS.component.burndown["min-points"] });
  }

  /** `--json --overview` (FR-012, contracts/dashboard-json.md): bare-`--json` stories plus aggregates. */
  private overviewJson(root: string, filters: Filters, upNextCap: number, stories: StoryProgress[]): unknown {
    const { features, issues } = readFeatures(root);
    const o = computeOverview(features, filters, { upNextCap }, issues);
    return {
      stories,
      summary: o.summary,
      statusCounts: o.statusCounts,
      features: o.features,
      attention: o.attention,
      upNext: o.upNext,
      burndown: this.burndown(root, features, filters, JSON_PERIODS),
      issues: o.issues,
      filters: { feature: filters.feature ?? null, status: filters.status ?? null, next: upNextCap },
    };
  }

  private renderTable(stories: StoryProgress[]): void {
    this.info(banner(this.caps));
    // Higher priority = kept longer when the terminal is narrow; drops Blocked-by → Prio → Feat first.
    const columns = [
      { header: "Feat", min: 3, priority: 50 },
      { header: "Story", min: 5, priority: 100 },
      { header: "Description", min: 8, priority: 80 },
      { header: "Progress", min: 15, priority: 90 },
      { header: "Status", min: 6, priority: 70 },
      { header: "Prio", min: 4, priority: 40 },
      { header: "Blocked-by", min: 6, priority: 30 },
    ];
    const rows: Cell[][] = stories.map((s) => [
      s.featureRef,
      s.displayId,
      truncate(s.title, 30),
      progressCell(s.tasksDone, s.tasksTotal),
      statusCell(s.status || "-"),
      s.priority || "-",
      s.blockedBy.length ? s.blockedBy.join(",") : "-",
    ]);
    this.info(renderTable(this.caps, { columns, rows, width: this.caps.columns }));

    const totalTasks = stories.reduce((n, s) => n + s.tasksTotal, 0);
    const doneTasks = stories.reduce((n, s) => n + s.tasksDone, 0);
    const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    this.info("");
    this.info(`Overall: ${stories.length} stories · ${doneTasks}/${totalTasks} tasks · ${pct}%`);
  }

  /** Launch the full-screen overview (US-5). Assumes a TTY (checked by the caller). */
  private async interactive(
    root: string,
    base: Omit<OverviewTuiData, "burndownFor">,
    filters: Filters,
  ): Promise<number> {
    const cache = new Map<string, Burndown>();
    const maxPeriods = maxPeriodsFor(this.caps.columns);
    const data: OverviewTuiData = {
      ...base,
      burndownFor: (f) => {
        const key = JSON.stringify([f.feature ?? null, f.status ?? null]);
        if (!cache.has(key)) cache.set(key, this.burndown(root, base.features, f, maxPeriods));
        return cache.get(key)!;
      },
    };
    await runFullscreen({
      initial: initOverviewTui(filters),
      render: (s) => renderOverviewTui(this.caps, data, s, (story) => tasksForStory(root, story)),
      reduce: (s, key) => reduceOverviewTui(data, s, key),
      isDone: isOverviewDone,
      // History is read after the first frame, so the burndown shows "computing" then fills in place.
      start: (update) =>
        setImmediate(() => {
          data.burndownFor(filters);
          update((s) => ({ ...s, burndownReady: true }));
        }),
    });
    return 0;
  }

  private detail(
    root: string,
    stories: StoryProgress[],
    storyArg: string,
    asJson: boolean,
  ): number {
    const matches = resolveStories(stories, storyArg);
    if (matches.length === 0) {
      this.error(`Story ${storyArg} not found.`);
      return 1;
    }
    if (matches.length > 1) {
      // Story ids restart per feature, so a bare id can match several. Ask the user to qualify.
      this.error(`Ambiguous story '${storyArg}' — it exists in ${matches.length} features:`);
      for (const m of matches) this.info(`  ${displayKey(m)}  (${m.feature})`);
      this.info(`Qualify it, e.g. \`ambykit dashboard ${displayKey(matches[0]!)}\`.`);
      return 1;
    }
    const story = matches[0]!;
    const tasks = tasksForStory(root, story);
    if (asJson) {
      this.info(JSON.stringify({ ...story, tasks }, null, 2));
      return 0;
    }
    this.info(`${displayKey(story)} — ${story.title}`);
    this.info(`  feature:    ${story.feature}`);
    this.info(`  status:     ${story.status || "-"}   priority: ${story.priority || "-"}`);
    this.info(`  progress:   ${story.tasksDone}/${story.tasksTotal} tasks (${story.percent}%)`);
    this.info(`  depends-on: ${story.dependsOn.join(", ") || "-"}`);
    this.info(`  blocked-by: ${story.blockedBy.join(", ") || "-"}`);
    if (tasks.length > 0) {
      this.info("  tasks:");
      for (const t of tasks) this.info(`    [${t.done ? "x" : " "}] ${t.id} ${t.description}`);
    }
    return 0;
  }
}

/**
 * Resolve a dashboard story argument to matching stories. Accepts a bare local id (`US-1`, which may
 * match several features) or a feature-qualified id (`001:US-1`, `001/US-1`, `001 US-1`).
 */
function resolveStories(stories: StoryProgress[], arg: string): StoryProgress[] {
  const qualified = /^(\w+?)[\s:/-]+(US-?\d+)$/i.exec(arg.trim());
  if (qualified) {
    const feat = qualified[1] ?? "";
    const local = canonicalStoryId(qualified[2] ?? "");
    return stories.filter((s) => s.id === local && (s.featureRef === feat || s.feature === feat));
  }
  const local = canonicalStoryId(arg);
  return stories.filter((s) => s.id === local);
}

function tasksForStory(root: string, story: StoryProgress): TaskLine[] {
  const tasksPath = join(root, "specs", story.feature, "tasks.md");
  if (!existsSync(tasksPath)) return [];
  try {
    return parseTasks(readFileSync(tasksPath, "utf8")).filter((t) => t.story === story.id);
  } catch {
    return []; // unreadable: already named by the caller (FR-014)
  }
}

/** The filtered feature for the feature view; keeps its panels when a status filter empties it. */
function featureInScope(features: FeatureSnapshot[], filters: Filters): FeatureSnapshot {
  const scoped = applyFilters(features, filters)[0];
  if (scoped) return scoped;
  const base = applyFilters(features, { feature: filters.feature })[0]!;
  return { ...base, stories: [], tasks: base.tasks ? [] : null };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

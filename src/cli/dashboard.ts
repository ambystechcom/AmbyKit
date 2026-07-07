import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import { banner } from "./banner.js";
import {
  canonicalStoryId,
  computeDashboard,
  displayKey,
  parseTasks,
  type StoryProgress,
  type TaskLine,
} from "../core/dashboard.js";
import { progressCell, renderTable, statusCell } from "./ui/table.js";
import type { Cell } from "./ui/types.js";
import { runFullscreen } from "./ui/interactive/fullscreen.js";
import {
  initDashboardTui,
  isDashboardDone,
  reduceDashboard,
  renderDashboardTui,
} from "./ui/interactive/dashboard.js";

export class DashboardCommand extends BaseCommand {
  readonly name = "dashboard";
  readonly summary = "Progress view over the story/task graph.";
  readonly usage = "ambykit dashboard [story-id] [--interactive] [--json] [--status=X] [--feature=X]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    let stories = computeDashboard(root);

    const storyArg = opts.positionals[0];
    if (storyArg) return this.detail(root, stories, storyArg, flag(opts, "json"));

    const statusFilter = stringFlag(opts, "status");
    const featureFilter = stringFlag(opts, "feature");
    if (statusFilter) stories = stories.filter((s) => s.status === statusFilter.toLowerCase());
    if (featureFilter) stories = stories.filter((s) => s.feature === featureFilter);

    if (flag(opts, "json")) {
      this.info(JSON.stringify(stories, null, 2));
      return 0;
    }
    if (stories.length === 0) {
      this.info("No user stories found. Run /amby.specify to create one.");
      return 0;
    }
    // Opt-in interactive view — only on a real terminal; otherwise fall back to one-shot (FR-014).
    if (flag(opts, "interactive") && this.caps.isTTY) {
      return this.interactive(root, stories);
    }
    this.renderTable(stories);
    return 0;
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

  /** Launch the opt-in full-screen navigable view (US-6). Assumes a TTY (checked by the caller). */
  private async interactive(root: string, stories: StoryProgress[]): Promise<number> {
    await runFullscreen({
      initial: initDashboardTui(stories),
      render: (s) => renderDashboardTui(this.caps, s, (story) => tasksForStory(root, story)),
      reduce: reduceDashboard,
      isDone: isDashboardDone,
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
  return parseTasks(readFileSync(tasksPath, "utf8")).filter((t) => t.story === story.id);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

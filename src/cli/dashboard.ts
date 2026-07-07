import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, flag, stringFlag, type CliOptions } from "./base-command.js";
import {
  canonicalStoryId,
  computeDashboard,
  parseTasks,
  type StoryProgress,
  type TaskLine,
} from "../core/dashboard.js";

export class DashboardCommand extends BaseCommand {
  readonly name = "dashboard";
  readonly summary = "Progress view over the story/task graph.";
  readonly usage = "ambykit dashboard [story-id] [--json] [--status=X] [--feature=X]";

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
    this.renderTable(stories);
    return 0;
  }

  private renderTable(stories: StoryProgress[]): void {
    const rows = stories.map((s) => [
      s.displayId,
      truncate(s.title, 32),
      `${s.tasksDone}/${s.tasksTotal}`,
      `${s.percent}%`,
      s.status || "-",
      s.priority || "-",
      s.blockedBy.length ? s.blockedBy.join(",") : "-",
    ]);
    const header = ["Story", "Description", "Tasks", "%", "Status", "Prio", "Blocked-by"];
    this.info(formatTable(header, rows));

    const totalTasks = stories.reduce((n, s) => n + s.tasksTotal, 0);
    const doneTasks = stories.reduce((n, s) => n + s.tasksDone, 0);
    const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    this.info("");
    this.info(`Overall: ${stories.length} stories · ${doneTasks}/${totalTasks} tasks · ${pct}%`);
  }

  private detail(
    root: string,
    stories: StoryProgress[],
    storyArg: string,
    asJson: boolean,
  ): number {
    const key = canonicalStoryId(storyArg);
    const story = stories.find((s) => s.id === key);
    if (!story) {
      this.error(`Story ${storyArg} not found.`);
      return 1;
    }
    const tasks = tasksForStory(root, story);
    if (asJson) {
      this.info(JSON.stringify({ ...story, tasks }, null, 2));
      return 0;
    }
    this.info(`${story.displayId} — ${story.title}`);
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

function tasksForStory(root: string, story: StoryProgress): TaskLine[] {
  const tasksPath = join(root, "specs", story.feature, "tasks.md");
  if (!existsSync(tasksPath)) return [];
  return parseTasks(readFileSync(tasksPath, "utf8")).filter((t) => t.story === story.id);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  return [line(header), sep, ...rows.map(line)].join("\n");
}

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
import { readProjectPresence, thresholdsFrom, type Thresholds } from "../core/activity.js";
import { matchAgents, type AgentMatch } from "../core/agents.js";
import { allCheckouts, readProjectFeatures, resolveCheckouts, type ProjectCheckouts } from "../core/checkouts.js";
import { loadConfig } from "../core/config.js";
import type { Burndown, Checkout, FeatureSnapshot, Filters, ParseIssue } from "../core/overview-types.js";
import { applyFilters, computeOverview } from "../core/overview.js";
import { packageVersion } from "../core/paths.js";
import { maxPeriodsFor } from "./ui/dashboard/burndown-chart.js";
import type { HeaderMeta } from "./ui/dashboard/cards.js";
import { layoutMode } from "./ui/dashboard/layout.js";
import { renderFeatureView, renderOverview } from "./ui/dashboard/render-overview.js";
import { TOKENS } from "./ui/dashboard/tokens.js";
import { progressCell, renderTable, statusCell } from "./ui/table.js";
import type { Cell } from "./ui/types.js";
import type { AmbyConfig } from "../core/types.js";
import { LIVE_TOKENS } from "./ui/dashboard/live-tokens.js";
import type { PresenceView } from "./ui/dashboard/worktrees-panel.js";
import { guardedScanner, listAgentProcesses } from "./ui/interactive/agent-scan.js";
import { runFullscreen } from "./ui/interactive/fullscreen.js";
import { targetsSignature, watchProject, watchTargets, type ProjectWatcher, type WatchMode } from "./ui/interactive/live.js";
import {
  applyData,
  initOverviewTui,
  isOverviewDone,
  reduceOverviewTui,
  renderOverviewTui,
  type OverviewTuiData,
  type OverviewTuiState,
} from "./ui/interactive/overview.js";

/** Periods for the plain series line and for `--json --overview` (a 100-column panel). */
const PLAIN_PERIODS = 12;
const JSON_PERIODS = maxPeriodsFor(100);

export class DashboardCommand extends BaseCommand {
  readonly name = "dashboard";
  readonly summary = "Progress view over the story/task graph.";
  readonly usage =
    "ambykit dashboard [story-id] [--interactive] [--stories] [--next=N] [--json [--overview]] [--status=X] [--feature=X] [--icons=nerd|unicode|ascii]";

  protected async execute(opts: CliOptions): Promise<number> {
    let root = this.projectRoot(opts.cwd);
    const filters: Filters = { feature: stringFlag(opts, "feature"), status: stringFlag(opts, "status") };
    if (!this.applyIcons(opts)) return 1;

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

    // The overview reads every checkout (017 FR-001) through `readFeatures`, which skips unreadable files (FR-014).
    const { features, issues, checkouts } = readProjectFeatures(root);
    root = checkouts.primary.root;
    if (filters.feature && applyFilters(features, { feature: filters.feature }).length === 0) {
      this.error(`Feature ${filters.feature} not found.`, "Use its number (e.g. 014) or its directory name.");
      return 1;
    }
    const meta = this.meta(root);
    // Opt-in interactive view — only on a real terminal; otherwise fall back to one-shot (FR-016).
    if (flag(opts, "interactive") && this.caps.isTTY) {
      return this.interactive(root, { features, issues, meta, upNextCap }, filters, checkouts);
    }

    const plain = layoutMode(this.caps) === "plain";
    const burndown = this.burndown(root, features, filters, plain ? PLAIN_PERIODS : maxPeriodsFor(this.caps.columns));
    const overview = computeOverview(features, filters, { upNextCap }, issues);
    // One-shot output reads self-reported markers only; the process scan is interactive-only (FR-017).
    const marked = readProjectPresence({ checkouts, features, matches: [], now: Date.now(), thresholds: this.thresholds(root) });
    const presence = marked.byFeature.size > 0 ? { ...marked, now: Date.now() } : undefined;
    const extra = presence ? { presence } : {};
    if (filters.feature) {
      const feature = featureInScope(features, filters);
      this.info(renderFeatureView(this.caps, { overview, feature, meta, burndown, ...extra }));
      return 0;
    }
    this.info(renderOverview(this.caps, { overview, meta, burndown, ...extra }));
    return 0;
  }

  /** Presence thresholds: `.amby/config.json` `dashboard`, else the token defaults (C-1). */
  private thresholds(root: string): Thresholds {
    return thresholdsFrom(readConfig(root), {
      activeMinutes: LIVE_TOKENS.time["active-min"],
      idleMinutes: LIVE_TOKENS.time["idle-min"],
    });
  }

  /** `--icons=nerd|unicode|ascii` overrides the detected agent-icon mode (FR-025). */
  private applyIcons(opts: CliOptions): boolean {
    const icons = stringFlag(opts, "icons");
    if (icons === undefined) return true;
    if (icons !== "nerd" && icons !== "unicode" && icons !== "ascii") {
      this.error(`--icons expects nerd, unicode or ascii, got '${icons}'.`, "e.g. ambykit dashboard --icons=nerd");
      return false;
    }
    const { icons: _drop, ...rest } = this.caps;
    this.caps = icons === "unicode" ? rest : { ...rest, icons };
    return true;
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

  /**
   * Burndown over the filtered features (FR-018/019). A scope that lives entirely in one worktree reads
   * that worktree's history, which follows its branch (017 FR-006); otherwise the primary checkout's.
   */
  private burndown(root: string, features: FeatureSnapshot[], filters: Filters, maxPeriods: number): Burndown {
    const scoped = applyFilters(features, filters);
    const { scope, current } = scopeOf(scoped, Boolean(filters.status));
    const roots = new Set(scoped.map((f) => checkoutRoot(root, f)));
    const historyRoot = roots.size === 1 ? [...roots][0]! : root;
    return readBurndown({ root: historyRoot, scope, current, maxPeriods, minPoints: TOKENS.component.burndown["min-points"] });
  }

  /** `--json --overview` (FR-012, contracts/dashboard-json.md): bare-`--json` stories plus aggregates. */
  private overviewJson(root: string, filters: Filters, upNextCap: number, stories: StoryProgress[]): unknown {
    const { features, issues, checkouts } = readProjectFeatures(root);
    const o = computeOverview(features, filters, { upNextCap }, issues);
    return {
      stories,
      summary: o.summary,
      statusCounts: o.statusCounts,
      // Each feature's source checkout (017 FR-007), without the machine-local path.
      features: o.features.map((r) => ({ ...r, checkout: checkoutJson(r.checkout) })),
      attention: o.attention,
      upNext: o.upNext,
      burndown: this.burndown(checkouts.primary.root, features, filters, JSON_PERIODS),
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

  /**
   * Launch the full-screen overview (US-5), live (feature 017, US-2/US-3): a watcher re-reads every
   * checkout on change, a heartbeat refreshes "ago" text, presence and the agent scan, and `stop()`
   * releases all of it on exit (FR-016). Assumes a TTY (checked by the caller).
   */
  private async interactive(
    root: string,
    base: Omit<OverviewTuiData, "burndownFor">,
    filters: Filters,
    initialCheckouts: ProjectCheckouts,
  ): Promise<number> {
    const cache = new Map<string, Burndown>();
    let maxPeriods = maxPeriodsFor(this.caps.columns);
    let checkouts = initialCheckouts;
    let matches: AgentMatch[] = [];
    const thresholds = this.thresholds(root);
    const presenceOf = (features: FeatureSnapshot[], now: number): PresenceView => ({
      ...readProjectPresence({ checkouts, features, matches, now, thresholds }),
      now,
    });
    const withBurndown = (d: Omit<OverviewTuiData, "burndownFor">): OverviewTuiData => ({
      ...d,
      burndownFor: (f) => {
        const key = JSON.stringify([f.feature ?? null, f.status ?? null]);
        if (!cache.has(key)) cache.set(key, this.burndown(root, d.features, f, maxPeriods));
        return cache.get(key)!;
      },
    });
    let data = withBurndown({ ...base, presence: presenceOf(base.features, Date.now()) });

    let update: ((fn: (s: OverviewTuiState) => OverviewTuiState) => void) | null = null;
    let watcher: ProjectWatcher | null = null;
    let heartbeat: NodeJS.Timeout | null = null;
    let stopped = false;
    const scan = guardedScanner(() => listAgentProcesses());

    const setLive = (mode: WatchMode): void =>
      update?.((s) => ({ ...s, now: Date.now(), live: { mode, lastChange: s.live?.lastChange ?? Date.now() } }));

    let armed = "";
    const arm = (): void => {
      watcher?.stop();
      const targets = watchTargets(checkouts);
      armed = targetsSignature(targets);
      watcher = watchProject(targets, refresh, undefined, { onMode: setLive });
    };
    // A worktree came or went, or a watched dir appeared after we armed (FR-011).
    const rearmNeeded = (): boolean => watcher?.mode !== "paused" && targetsSignature(watchTargets(checkouts)) !== armed;

    // Re-read every checkout and swap the data in, keeping cursors and input (FR-010–FR-012).
    const refresh = (): void => {
      if (stopped) return;
      try {
        const read = readProjectFeatures(root, resolveCheckouts(root));
        checkouts = read.checkouts;
        const prev = data;
        cache.clear();
        const now = Date.now();
        data = withBurndown({ ...prev, features: read.features, issues: read.issues, presence: presenceOf(read.features, now) });
        if (rearmNeeded()) arm();
        update?.((s) => ({ ...applyData(s, prev, data), now, live: { mode: watcher?.mode ?? "paused", lastChange: now } }));
      } catch {
        setLive("paused");
      }
    };

    // Heartbeat (FR-014, FR-027): clears the changed highlight, ages presence, and scans for agents.
    const beat = (): void => {
      if (stopped) return;
      if (rearmNeeded()) {
        arm();
        refresh();
      }
      const now = Date.now();
      data = withBurndown({ ...data, presence: presenceOf(data.features, now) });
      update?.((s) => ({ ...s, now, changed: new Set(), changedTasks: new Set() }));
      void scan().then((found) => {
        if (stopped || found === null) return;
        matches = matchAgents(found, allCheckouts(checkouts), process.pid);
        data = withBurndown({ ...data, presence: presenceOf(data.features, Date.now()) });
        update?.((s) => ({ ...s }));
      });
    };

    await runFullscreen({
      initial: { ...initOverviewTui(filters), live: { mode: "watching", lastChange: Date.now() } },
      render: (s) => renderOverviewTui(this.caps, data, s),
      reduce: (s, key) => {
        // `r` restarts monitoring when it is paused (ui.md LiveIndicator).
        if (key.name === "r" && s.input === null && s.live?.mode === "paused") {
          arm();
          refresh();
          return { ...s, live: { mode: watcher?.mode ?? "paused", lastChange: Date.now() } };
        }
        return reduceOverviewTui(data, s, key);
      },
      isDone: isOverviewDone,
      start: (u) => {
        update = u;
        arm();
        setLive(watcher!.mode);
        heartbeat = setInterval(beat, LIVE_TOKENS.time["heartbeat-s"] * 1000);
        // History is read after the first frame, so the burndown shows "computing" then fills in place.
        setImmediate(() => {
          if (stopped) return;
          data.burndownFor(filters);
          u((s) => ({ ...s, burndownReady: true }));
          beat();
        });
      },
      resize: (columns) => {
        this.caps = { ...this.caps, columns };
        maxPeriods = maxPeriodsFor(columns);
        cache.clear();
      },
      stop: () => {
        stopped = true;
        watcher?.stop();
        if (heartbeat) clearInterval(heartbeat);
        update = null;
      },
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

/** The checkout a feature was read from (017 FR-006): its worktree, else the primary checkout. */
function checkoutRoot(primary: string, f: FeatureSnapshot): string {
  return f.checkout?.root ?? primary;
}

function checkoutJson(c: Checkout | undefined): Omit<Checkout, "root"> {
  if (!c || c.kind === "main") return { kind: "main" };
  const { root: _root, ...rest } = c;
  return rest;
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

/** The project config, or null when it is missing or invalid (the dashboard never requires one). */
function readConfig(root: string): AmbyConfig | null {
  try {
    return loadConfig(root);
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

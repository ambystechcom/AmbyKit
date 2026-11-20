import type { StoryProgress, TaskLine } from "../../../core/dashboard.js";
import type { FeatureSnapshot, Filters, ParseIssue } from "../../../core/overview-types.js";
import { applyFilters, computeOverview } from "../../../core/overview.js";
import type { BurndownState } from "../dashboard/burndown-chart.js";
import type { HeaderMeta } from "../dashboard/cards.js";
import { emptyState, noMatchLine } from "../dashboard/empty-state.js";
import type { FleetView } from "../../../core/fleet-view/types.js";
import { currentFleet, featureRunView, filterLanes, groupCounts, groupRows, isGrouped, type GroupFilter } from "../../../core/fleet-view/group.js";
import type { FleetsView } from "../../../core/fleet/fleet-view.js";
import type { Metrics } from "../../../core/metrics/types.js";
import type { FleetViewApi } from "../dashboard/fleet-view.js";
import type { FleetTabApi } from "../dashboard/fleet-tab.js";
import { renderMetricsPanel } from "../dashboard/metrics-panel.js";
import type { TabBadges } from "../dashboard/tab-bar.js";
import { noMatchBody, renderFilterLine, renderTabFrame, tabEmptyBody } from "../dashboard/tab-frame.js";
import { tabLayout } from "../dashboard/layout.js";
import { applyListFilter } from "./list-filter.js";
import type { GraphViewApi, GraphViewModel } from "../dashboard/graph-view.js";
import { renderQualityView } from "../dashboard/quality-view.js";
import { renderHelp, type HelpScreen } from "../dashboard/help-overlay.js";
import { liveIndicator, type LiveStatus } from "../dashboard/live-indicator.js";
import { LIVE_TOKENS } from "../dashboard/live-tokens.js";
import { renderFeatureView, renderOverview } from "../dashboard/render-overview.js";
import { DETAIL_MAX_TASKS, maxScroll, renderStoryDetail } from "../dashboard/story-detail.js";
import { TOKENS } from "../dashboard/tokens.js";
import { worktreeItems, type PresenceView } from "../dashboard/worktrees-panel.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import type { FleetTuiState } from "./fleet.js";
import type { KeyEvent } from "./fullscreen.js";
import { tabForKey, type Tab } from "./tabs.js";

/**
 * Interactive dashboard (features 014 and 017). Pure reducer + renderer over injected data; the
 * fullscreen host owns IO. Overview: `tab` cycles Attention → Up next → Worktrees & agents → Feature
 * completion and `⏎` opens the feature view; there `⏎` opens the story detail. `?` shows help on
 * every screen. Refreshed data arrives through `applyData`.
 */

/** Feature 032 (US-4): workflow metrics, read after the first paint; absent outside the interactive dashboard. */
export type MetricsState = { status: "loading" } | { status: "ready"; metrics: Metrics } | { status: "failed" };

export interface OverviewTuiData {
  features: FeatureSnapshot[];
  issues: ParseIssue[];
  meta: HeaderMeta;
  upNextCap: number;
  /** Burndown for a filter set (memoized by the command). */
  burndownFor: (filters: Filters) => BurndownState;
  /** Agent presence (feature 017); absent ⇒ no agent columns. */
  presence?: PresenceView;
  /**
   * Feature 023: the dependency-graph view, injected by the command after a dynamic import so the one-shot
   * path never loads it (FR-015). Absent ⇒ `g` does nothing.
   */
  graphView?: GraphViewApi;
  /**
   * Feature 029: the Fleet view, injected by the command after a dynamic import so the one-shot and `--json` paths
   * never load it (FR-012). Absent ⇒ `l` does nothing.
   */
  fleetView?: FleetViewApi;
  /** The current fleet run as read from spec 025's files; null/absent ⇒ no run. */
  fleet?: FleetView | null;
  /** Feature 032: the metrics read, delivered without blocking; a failure leaves every other view working. */
  metricsState?: MetricsState;
  /** Terminal rows, for the Fleet view's scroll window (default 24). */
  rows?: number;
  /**
   * Feature 032: draw the tabbed frame (tab bar, shared filter line, the metrics panel, grouped fleet) around every screen.
   * Set only by the interactive command; absent ⇒ the screens render exactly as before 032.
   */
  tabs?: boolean;
  /** Spec 031's fleets (features, their lanes and states), for the Fleet tab's grouping by feature. */
  fleets?: FleetsView | null;
  /** The grouped Fleet tab's renderer, injected after a dynamic import like the other views. */
  fleetTab?: FleetTabApi;
}

export type Panel = 0 | 1 | 2 | 3;
const PANELS = 4;

/** The feature view's story list, and the story detail opened from it. */
export interface StoryNav {
  stories: StoryProgress[];
  cursor: number;
  mode: "list" | "detail";
  /** First visible task in the story detail. */
  scroll: number;
}

export interface OverviewTuiState {
  view: "overview" | "feature" | "graph" | "fleet";
  focus: Panel;
  cursors: [number, number, number, number];
  filters: Filters;
  /** Feature-filter text being typed after `f` (or search text after `/`); null when not typing. */
  input: string | null;
  /** The field being typed is the free-text search (`/`), not the exact feature filter (`f`). */
  searching?: boolean;
  feature: string | null; // dir, in feature view
  story: StoryNav | null;
  /** Feature 023: the graph view's cursor over the open stories; null outside the graph view. */
  graph: { cursor: number } | null;
  /** Feature 029: the Fleet view's cursor, scroll, confirm dialog and intended action; null outside it. */
  fleet: FleetTuiState | null;
  /** Feature 032: the grouped Fleet tab's cursor over feature and lane rows, and the collapsed features; null otherwise. */
  fleetGroup: { cursor: number; collapsed: string[] } | null;
  /** Help overlay open (FR-030). */
  help: boolean;
  /** Quality view open (feature 024, FR-013): uncovered requirements and analyze findings. */
  quality: boolean;
  burndownReady: boolean;
  done: boolean;
  /** Live-update status (feature 017); absent outside live mode. */
  live?: LiveStatus;
  /** Feature dirs changed by the last refresh, highlighted until the next heartbeat (ChangedHighlight). */
  changed: ReadonlySet<string>;
  /** `<dir>/<task id>` of tasks checked by the last refresh. */
  changedTasks: ReadonlySet<string>;
  /** Clock for "ago" text, advanced by the heartbeat so rendering stays pure. */
  now: number;
}

const STATUS_CYCLE: (string | undefined)[] = [undefined, "draft", "ready", "in-progress", "blocked", "done", "deferred"];
const NO_CURSORS: OverviewTuiState["cursors"] = [0, 0, 0, 0];

export function initOverviewTui(filters: Filters = {}): OverviewTuiState {
  return {
    view: "overview",
    focus: 0,
    cursors: NO_CURSORS,
    filters,
    input: null,
    feature: null,
    story: null,
    graph: null,
    fleet: null,
    fleetGroup: null,
    help: false,
    quality: false,
    burndownReady: false,
    done: false,
    changed: new Set(),
    changedTasks: new Set(),
    now: Date.now(),
  };
}

export function isOverviewDone(state: OverviewTuiState): boolean {
  return state.done;
}

function overviewOf(data: OverviewTuiData, filters: Filters) {
  return computeOverview(data.features, filters, { upNextCap: data.upNextCap }, data.issues);
}

/** The feature as the feature view shows it: filtered by the active status filter. */
function featureInView(features: FeatureSnapshot[], filters: Filters, dir: string): FeatureSnapshot | undefined {
  return applyFilters(features, { ...filters, feature: dir })[0];
}

/** A story's tasks, from the snapshot (the checkout it was read from, 017 FR-006). */
export function storyTasks(features: FeatureSnapshot[], dir: string, story: StoryProgress): TaskLine[] {
  return features.find((f) => f.dir === dir)?.tasks?.filter((t) => t.story === story.id) ?? [];
}

/** Items in each focusable panel, for cursor bounds. */
function panelSizes(data: OverviewTuiData, state: OverviewTuiState): OverviewTuiState["cursors"] {
  const o = overviewOf(data, state.filters);
  // Worktrees & agents: only feature rows are openable; unlocated agents are skipped (ui.md US-3).
  return [o.attention.length, o.upNext.items.length, worktreeItems(o.features, data.presence).length, o.features.length];
}

/** Open the feature view for `dir`, selecting the story whose display id is `storyId`. */
function openFeature(data: OverviewTuiData, state: OverviewTuiState, dir: string, storyId?: string): OverviewTuiState {
  const feature = featureInView(data.features, state.filters, dir);
  if (!feature) return state;
  const idx = storyId ? feature.stories.findIndex((s) => s.displayId === storyId) : -1;
  return { ...state, view: "feature", feature: dir, story: { stories: feature.stories, cursor: Math.max(0, idx), mode: "list", scroll: 0 } };
}

function openSelected(data: OverviewTuiData, state: OverviewTuiState): OverviewTuiState {
  const o = overviewOf(data, state.filters);
  const cur = state.cursors[state.focus];
  const byRef = (ref: string) => data.features.find((f) => f.displayRef === ref)?.dir;
  if (state.focus === 0) {
    const item = o.attention[cur];
    if (!item) return state;
    const [ref, id] = splitKey(item.key);
    const dir = byRef(ref);
    return dir ? openFeature(data, state, dir, id) : state;
  }
  if (state.focus === 1) {
    const item = o.upNext.items[cur];
    if (!item) return state;
    return openFeature(data, state, item.feature, item.storyKey ? splitKey(item.storyKey)[1] : undefined);
  }
  if (state.focus === 2) {
    const item = worktreeItems(o.features, data.presence)[cur];
    return item ? openFeature(data, state, item.feature.name) : state;
  }
  const row = o.features[cur];
  return row ? openFeature(data, state, row.name) : state;
}

function splitKey(key: string): [string, string] {
  const at = key.lastIndexOf(":");
  return [key.slice(0, at), key.slice(at + 1)];
}

/** Stable identities of each panel's items, for keeping the cursor on the same item across refreshes. */
function panelIds(data: OverviewTuiData, filters: Filters): [string[], string[], string[], string[]] {
  const o = overviewOf(data, filters);
  return [
    o.attention.map((a) => a.key),
    o.upNext.items.map((u) => `${u.feature}:${u.taskId}`),
    worktreeItems(o.features, data.presence).map((i) => i.feature.name),
    o.features.map((r) => r.name),
  ];
}

/** Keep `cursor` on the item it pointed at; when that item is gone, clamp to the nearest row. */
function followCursor(oldIds: string[], newIds: string[], cursor: number): number {
  const id = oldIds[cursor];
  const at = id === undefined ? -1 : newIds.indexOf(id);
  if (at >= 0) return at;
  return Math.max(0, Math.min(cursor, newIds.length - 1));
}

/** What a feature row shows, for change detection. */
function rowSignature(f: FeatureSnapshot): string {
  const done = f.tasks?.filter((t) => t.done).length ?? -1;
  return JSON.stringify([done, f.tasks?.length ?? -1, f.stories.map((s) => s.status), f.clarifications.length, f.checkout?.dirty, f.checkout?.stale]);
}

/** Feature dirs whose visible progress differs between two data sets (new features included). */
export function changedFeatures(prev: FeatureSnapshot[], next: FeatureSnapshot[]): Set<string> {
  const before = new Map(prev.map((f) => [f.dir, rowSignature(f)]));
  return new Set(next.filter((f) => before.get(f.dir) !== rowSignature(f)).map((f) => f.dir));
}

/** `<dir>/<task id>` for every task that became checked. */
export function checkedTasks(prev: FeatureSnapshot[], next: FeatureSnapshot[]): Set<string> {
  const done = new Set(prev.flatMap((f) => (f.tasks ?? []).filter((t) => t.done).map((t) => `${f.dir}/${t.id}`)));
  return new Set(next.flatMap((f) => (f.tasks ?? []).filter((t) => t.done).map((t) => `${f.dir}/${t.id}`)).filter((k) => !done.has(k)));
}

/**
 * Apply refreshed data (feature 017, FR-012): the view, filters, typed input and help stay; cursors
 * follow their item by id and clamp when it is gone; a feature view whose feature vanished returns
 * to the overview. Records what changed for the highlight.
 */
export function applyData(state: OverviewTuiState, prev: OverviewTuiData, next: OverviewTuiData): OverviewTuiState {
  const before = panelIds(prev, state.filters);
  const after = panelIds(next, state.filters);
  const cursors = state.cursors.map((c, i) => followCursor(before[i]!, after[i]!, c)) as OverviewTuiState["cursors"];
  const out: OverviewTuiState = {
    ...state,
    cursors,
    changed: changedFeatures(prev.features, next.features),
    changedTasks: checkedTasks(prev.features, next.features),
  };
  if (state.view === "fleet" && state.fleet && next.fleetView) {
    const entry = next.tabs ? currentFleet(next.fleets) : null;
    if (state.fleetGroup && isGrouped(entry)) {
      const n = groupRows(entry, state.fleetGroup.collapsed, groupFilterOf(state)).length;
      return { ...out, fleetGroup: { ...state.fleetGroup, cursor: Math.max(0, Math.min(state.fleetGroup.cursor, n - 1)) } };
    }
    const view = visibleFleet(next, state);
    return { ...out, fleet: next.fleetView.clamp(view, state.fleet, next.fleetView.windowRows(next.rows ?? 24, view)) };
  }
  if (state.view === "graph" && state.graph) {
    const n = next.graphView ? graphModelFor(next, state).rows.length : 0;
    return { ...out, graph: { cursor: Math.max(0, Math.min(state.graph.cursor, n - 1)) } };
  }
  if (state.view !== "feature" || !state.feature) return out;
  const feature = featureInView(next.features, state.filters, state.feature);
  if (!feature) return { ...out, view: "overview", feature: null, story: null };
  if (!state.story) return out;
  const nav = state.story;
  const cursor = followCursor(nav.stories.map((s) => s.displayId), feature.stories.map((s) => s.displayId), nav.cursor);
  const mode = feature.stories.length === 0 ? "list" : nav.mode;
  return { ...out, story: { ...nav, stories: feature.stories, cursor, mode } };
}

/** Pure `(state, key) → state`. */
export function reduceOverviewTui(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  if (state.help) return { ...state, help: false }; // any key closes help and is not passed on
  if (state.input !== null) return reduceInput(state, key);
  // An open Fleet confirmation owns the next key (even `?`), so a stray key can only cancel it (029 FR-008).
  if (state.view === "fleet" && state.fleet?.confirm) return reduceFleetView(data, state, key);
  // Feature 032 (FR-004): `1`-`4`, `]` and `[` switch tabs from any screen; anything else is not a tab key.
  const target = key.ctrl ? null : tabForKey(tabOf(state), key);
  if (target) return selectTab(data, state, target);
  // Tab mode (feature 032): the quality tab is a tab like the others (help, the shared filter, esc to go back); a key that
  // means nothing here changes nothing (FR-004). Without tab mode the quality view keeps its 024 behaviour: any key leaves it.
  if (data.tabs && state.quality) {
    if (key.name === "q") return { ...state, done: true };
    if (key.sequence === "?") return { ...state, help: true };
    const shared = reduceSharedFilter(state, key);
    if (shared) return shared;
    return key.name === "escape" ? { ...state, quality: false } : state;
  }
  if (state.quality) return key.name === "q" ? { ...state, done: true } : { ...state, quality: false };
  if (key.sequence === "?") return { ...state, help: true };
  if (data.tabs && (state.view === "fleet" || state.view === "graph")) {
    const shared = reduceSharedFilter(state, key);
    if (shared) return shared;
  }
  if (state.view === "fleet") return reduceFleetView(data, state, key);
  if (state.view === "feature") return reduceFeature(data, state, key);
  if (state.view === "graph") return reduceGraph(data, state, key);
  // `/` opens a free-text search over feature names and numbers (feature 032, US-3); `f` keeps the exact feature filter.
  if (key.sequence === "/") return { ...state, input: state.filters.search ?? "", searching: true };

  switch (key.name) {
    case "q":
      return { ...state, done: true };
    case "g":
      return data.graphView ? { ...state, view: "graph", graph: { cursor: 0 } } : state;
    case "l":
      return data.fleetView ? { ...state, view: "fleet", ...enterFleet(data) } : state;
    case "tab": {
      const step = key.shift ? PANELS - 1 : 1;
      return { ...state, focus: ((state.focus + step) % PANELS) as Panel };
    }
    case "up":
    case "down": {
      const n = panelSizes(data, state)[state.focus];
      if (n === 0) return state;
      const cursors = [...state.cursors] as OverviewTuiState["cursors"];
      cursors[state.focus] = (cursors[state.focus] + (key.name === "up" ? n - 1 : 1)) % n;
      return { ...state, cursors };
    }
    case "return":
    case "enter":
      return openSelected(data, state);
    case "escape":
      return state.filters.feature || state.filters.status || state.filters.search ? { ...state, filters: {}, cursors: NO_CURSORS } : state;
    case "c":
      return { ...state, quality: true };
    case "f":
      return { ...state, input: state.filters.feature ?? "", searching: false };
    case "s": {
      const i = STATUS_CYCLE.indexOf(state.filters.status);
      const status = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
      return { ...state, filters: { ...state.filters, status }, cursors: NO_CURSORS };
    }
    default:
      return state;
  }
}

/** The tab a state is on: the feature view and story detail belong to the overview tab. */
export function tabOf(state: OverviewTuiState): Tab {
  if (state.quality) return "quality";
  if (state.view === "fleet") return "fleet";
  if (state.view === "graph") return "graph";
  return "overview";
}

/** Switch to `tab`. A tab whose view is not available (no graph or fleet view injected) leaves the state unchanged. */
function selectTab(data: OverviewTuiData, state: OverviewTuiState, tab: Tab): OverviewTuiState {
  const here = tabOf(state);
  // Pressing the overview key from the feature view goes back up to the overview; any other same-tab key is a no-op.
  if (tab === here && !(tab === "overview" && state.view !== "overview")) return state;
  const cleared: OverviewTuiState = { ...state, view: "overview", feature: null, story: null, graph: null, fleet: null, fleetGroup: null, quality: false };
  switch (tab) {
    case "overview":
      return cleared;
    case "fleet":
      return data.fleetView ? { ...cleared, view: "fleet", ...enterFleet(data) } : state;
    case "graph":
      return data.graphView ? { ...cleared, view: "graph", graph: { cursor: 0 } } : state;
    case "quality":
      return { ...cleared, quality: true };
  }
}

/** Entering the Fleet tab: 029's slice, plus the group cursor when a fleet of two or more features is shown (tab mode). */
function enterFleet(data: OverviewTuiData): Pick<OverviewTuiState, "fleet" | "fleetGroup"> {
  return { fleet: data.fleetView!.init(), fleetGroup: data.tabs && isGrouped(currentFleet(data.fleets)) ? { cursor: 0, collapsed: [] } : null };
}

/** The shared filter as a text-and-state filter over lanes (feature 032, US-3). */
function groupFilterOf(state: OverviewTuiState): GroupFilter {
  return { query: state.filters.search ?? state.filters.feature ?? "", ...(state.filters.status !== undefined ? { state: state.filters.status } : {}) };
}

/** The current run as the Fleet view shows it in tab mode: its lanes narrowed by the shared filter. */
function visibleFleet(data: OverviewTuiData, state: OverviewTuiState): FleetView | null {
  const view = data.fleet ?? null;
  if (!view || !data.tabs) return view;
  return { ...view, lanes: filterLanes(view.lanes, groupFilterOf(state)) };
}

/** The dependency graph narrowed by the shared filter: text over the story id and title, and the status as buildable/blocked. */
function graphModelFor(data: OverviewTuiData, state: OverviewTuiState): GraphViewModel {
  const model = data.graphView!.build(data.features);
  if (!data.tabs) return model;
  const f = groupFilterOf(state);
  const status = f.state === undefined ? undefined : ({ blocked: "blocked", ready: "buildable" } as Record<string, string>)[f.state] ?? " ";
  const rows = applyListFilter(model.rows.map((r) => ({ ...r, state: r.state })), { query: f.query, ...(status !== undefined ? { state: status } : {}) });
  return { ...model, rows };
}

/** `/`, `s` and `esc` on a tab other than the overview: the same shared filter (feature 032, US-3). Null when not a filter key. */
function reduceSharedFilter(state: OverviewTuiState, key: KeyEvent): OverviewTuiState | null {
  const reset = { cursors: NO_CURSORS, graph: state.graph ? { cursor: 0 } : state.graph, fleetGroup: state.fleetGroup ? { ...state.fleetGroup, cursor: 0 } : null, fleet: state.fleet ? { ...state.fleet, cursor: 0, scroll: 0 } : state.fleet };
  if (key.sequence === "/") return { ...state, input: state.filters.search ?? "", searching: true };
  if (key.name === "s") {
    const i = STATUS_CYCLE.indexOf(state.filters.status);
    return { ...state, filters: { ...state.filters, status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] }, ...reset };
  }
  if (key.name === "escape" && (state.filters.feature || state.filters.status || state.filters.search)) return { ...state, filters: {}, ...reset };
  return null;
}

function reduceInput(state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  const text = state.input ?? "";
  if (key.name === "escape") return { ...state, input: null, searching: false };
  if (key.name === "return" || key.name === "enter") {
    const filters = state.searching ? { ...state.filters, search: text || undefined } : { ...state.filters, feature: text || undefined };
    return { ...state, input: null, searching: false, filters, cursors: NO_CURSORS };
  }
  if (key.name === "backspace") return { ...state, input: text.slice(0, -1) };
  const ch = key.sequence ?? "";
  if (!key.ctrl && ch.length === 1 && ch >= " " && ch <= "~") return { ...state, input: text + ch };
  return state;
}

/** Graph view (feature 023): `↑↓` move over the open stories, `⏎` jumps to the story's feature, `esc` returns. */
/** Feature 029: the Fleet view's keys. The slice records an intended action; the command performs it (like `r`). */
function reduceFleetView(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  const api = data.fleetView;
  if (!api || !state.fleet) return { ...state, view: "overview", fleet: null, fleetGroup: null };
  const entry = data.tabs ? currentFleet(data.fleets) : null;
  if (state.fleetGroup && isGrouped(entry)) return reduceFleetGroup(data, state, key, api, entry);
  const view = visibleFleet(data, state);
  const rows = api.windowRows(data.rows ?? 24, view);
  const next = api.reduce(view, state.fleet, key, rows);
  if (next.quit) return { ...state, done: true };
  if (next.back) return { ...state, view: "overview", fleet: null, fleetGroup: null };
  return { ...state, fleet: next };
}

/** The 029 view of the feature under the grouped cursor (null on a feature that has not started, or outside the group). */
export function selectedFleetView(data: OverviewTuiData, state: OverviewTuiState): FleetView | null {
  const entry = data.tabs ? currentFleet(data.fleets) : null;
  if (!state.fleetGroup || !isGrouped(entry)) return data.fleet ?? null;
  const rows = groupRows(entry, state.fleetGroup.collapsed, groupFilterOf(state));
  const row = rows[Math.min(state.fleetGroup.cursor, Math.max(0, rows.length - 1))];
  return row ? featureRunView(row.feature, data.fleet?.now ?? state.now) : null;
}

/**
 * The grouped Fleet tab's keys (feature 032, FR-018): `↑↓` move over feature and lane rows, `←`/`→` collapse and expand a
 * feature, and every directive or approve key goes to 029's reducer for the feature under the cursor, so its confirm
 * dialog and rules are the same ones (a lane action needs a lane row; `P U X a` work on the feature's run).
 */
function reduceFleetGroup(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent, api: FleetViewApi, entry: NonNullable<ReturnType<typeof currentFleet>>): OverviewTuiState {
  const group = state.fleetGroup!;
  const filter = groupFilterOf(state);
  const rows = groupRows(entry, group.collapsed, filter);
  const cursor = Math.min(group.cursor, Math.max(0, rows.length - 1));
  const row = rows[cursor];
  if (!state.fleet!.confirm) {
    if ((key.name === "up" || key.name === "down") && rows.length > 0) {
      const step = key.name === "up" ? rows.length - 1 : 1;
      return { ...state, fleetGroup: { ...group, cursor: (cursor + step) % rows.length }, fleet: { ...state.fleet!, notice: null } };
    }
    if ((key.name === "left" || key.name === "right") && row) {
      const name = row.feature.feature;
      const collapsed = key.name === "left" ? (group.collapsed.includes(name) ? group.collapsed : [...group.collapsed, name]) : group.collapsed.filter((c) => c !== name);
      const at = groupRows(entry, collapsed, filter).findIndex((r) => r.kind === "feature" && r.feature.feature === name);
      return { ...state, fleetGroup: { collapsed, cursor: at >= 0 ? at : cursor } };
    }
    // A lane action needs a lane row: on a feature header say so instead of acting on its first lane.
    if (row?.kind === "feature" && (key.sequence === "p" || key.sequence === "u" || key.sequence === "x")) {
      return { ...state, fleet: { ...state.fleet!, notice: "Select a lane to pause, continue or stop it; P, U and X act on the whole run." } };
    }
  }
  const view = row ? featureRunView(row.feature, data.fleet?.now ?? state.now) : null;
  const inner = { ...state.fleet!, cursor: row?.kind === "lane" ? row.index : 0 };
  const next = api.reduce(view, inner, key, data.rows ?? 24);
  if (next.quit) return { ...state, done: true };
  if (next.back) return { ...state, view: "overview", fleet: null, fleetGroup: null };
  return { ...state, fleet: next };
}

function reduceGraph(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  if (key.name === "q") return { ...state, done: true };
  const toOverview = { ...state, view: "overview" as const, graph: null };
  const model = data.graphView ? graphModelFor(data, state) : undefined;
  if (!model) return toOverview;
  if (key.name === "escape" || key.name === "backspace" || key.name === "left") return toOverview;
  const n = model.rows.length;
  if (n === 0) return state;
  const cursor = Math.min(state.graph?.cursor ?? 0, n - 1);
  switch (key.name) {
    case "up":
      return { ...state, graph: { cursor: (cursor - 1 + n) % n } };
    case "down":
      return { ...state, graph: { cursor: (cursor + 1) % n } };
    case "return":
    case "enter": {
      const row = model.rows[cursor]!;
      // The graph shows every feature, so clear a filter that would hide the target rather than do nothing.
      const jump = openFeature(data, { ...state, graph: null }, row.feature, row.story);
      if (jump.view === "feature") return jump;
      return openFeature(data, { ...state, graph: null, filters: {}, cursors: NO_CURSORS }, row.feature, row.story);
    }
    default:
      return state;
  }
}

function reduceFeature(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  if (key.name === "q") return { ...state, done: true };
  const nav = state.story;
  const back = key.name === "escape" || key.name === "backspace" || key.name === "left";
  const toOverview = { ...state, view: "overview" as const, feature: null, story: null };
  if (!nav) return back ? toOverview : state;

  if (nav.mode === "detail") {
    if (back) return { ...state, story: { ...nav, mode: "list" } };
    if (key.name !== "up" && key.name !== "down") return state;
    const story = nav.stories[nav.cursor];
    const total = story && state.feature ? storyTasks(data.features, state.feature, story).length : 0;
    const scroll = Math.min(Math.max(0, nav.scroll + (key.name === "up" ? -1 : 1)), maxScroll(total, DETAIL_MAX_TASKS));
    return { ...state, story: { ...nav, scroll } };
  }

  if (back) return toOverview;
  const n = nav.stories.length;
  if (n === 0) return state;
  switch (key.name) {
    case "up":
      return { ...state, story: { ...nav, cursor: (nav.cursor - 1 + n) % n } };
    case "down":
      return { ...state, story: { ...nav, cursor: (nav.cursor + 1) % n } };
    case "return":
    case "enter":
      return { ...state, story: { ...nav, mode: "detail", scroll: 0 } };
    default:
      return state;
  }
}

function keyHints(caps: Capabilities, pairs: [string, string][]): string {
  const k = TOKENS.component["key-hints"];
  return pairs.map(([key, label]) => `${paintToken(caps, k["key-fg"], key)} ${paintToken(caps, k["label-fg"], label)}`).join("  ");
}

function filterNote(filters: Filters): string {
  const parts = [filters.feature ? `feature=${filters.feature}` : "", filters.search ? `search=${filters.search}` : "", filters.status ? `status=${filters.status}` : ""].filter(Boolean);
  return parts.length ? `  [${parts.join(" ")}]` : "";
}

const FILTER_FIELD = 36;

/** FilterInput (ui.md US-4): ` filter  ( 017▏          )   ⏎ apply  esc cancel` in the hint row. */
function filterInput(caps: Capabilities, value: string, label = "filter"): string {
  const t = LIVE_TOKENS.component.input;
  const caret = caps.unicode ? t.caret.u : t.caret.a;
  const shown = value.length > FILTER_FIELD - 2 ? value.slice(-(FILTER_FIELD - 2)) : value;
  const field = paintToken(caps, t.fg, shown) + paintToken(caps, t["frame-fg"], caret) + " ".repeat(Math.max(0, FILTER_FIELD - 1 - shown.length));
  const frame = (s: string) => paintToken(caps, t["frame-fg"], s);
  return ` ${paintToken(caps, t["label-fg"], label)}  ${frame("(")} ${field}${frame(")")}   ${keyHints(caps, [[caps.unicode ? "⏎" : "enter", "apply"], ["esc", "cancel"]])}`;
}

function metaOf(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): HeaderMeta {
  return { ...data.meta, interactive: true, ...(state.live ? { live: liveIndicator(caps, state.live, state.now) } : {}) };
}

/** EmptyState for the interactive overview: no specs at all, or a filter that matches nothing. */
function emptyLines(caps: Capabilities, data: OverviewTuiData, filters: Filters): string[] {
  if (data.tabs) {
    return data.features.length === 0 ? tabEmptyBody(caps, "overview") : noMatchBody(caps, [filters.feature, filters.search, filters.status].filter(Boolean).join(" "));
  }
  if (data.features.length === 0) {
    return emptyState(caps, "No feature specs yet.", { before: "Run ", command: "/amby.specify", after: " to create one." }, caps.columns);
  }
  return ["", noMatchLine(caps, [filters.feature, filters.search, filters.status].filter(Boolean).join(" "))];
}

/** Which tabs have something to read first (ui.md "Tab bar"): a stalled or blocked lane, graph problems, findings. */
function tabBadges(data: OverviewTuiData): TabBadges {
  const badges: TabBadges = {};
  const attention = (v: FleetView | null | undefined): boolean => !!v && (v.run.needsDecision || v.lanes.some((l) => l.stalled || l.state === "blocked"));
  const entry = currentFleet(data.fleets);
  const fleetFlag = attention(data.fleet) || !!entry?.features.some((f) => f.state === "paused" || f.run?.needsDecision || f.lanes.some((l) => l.stalled || l.state === "blocked"));
  if (fleetFlag) badges.fleet = "attention";
  if (data.graphView && data.graphView.build(data.features).problems > 0) badges.graph = "warn";
  const o = overviewOf(data, {});
  if (o.attention.length > 0 || data.features.some((f) => (f.coverage?.uncovered.length ?? 0) > 0)) badges.quality = "warn";
  return badges;
}

/** Items shown and the unfiltered total on a tab, for the filter line's "n of N match". */
function tabCounts(data: OverviewTuiData, state: OverviewTuiState, tab: ReturnType<typeof tabOf>): { shown: number; total: number } {
  switch (tab) {
    case "fleet": {
      const entry = currentFleet(data.fleets);
      if (state.fleetGroup && isGrouped(entry)) return groupCounts(entry, groupFilterOf(state));
      return { shown: visibleFleet(data, state)?.lanes.length ?? 0, total: data.fleet?.lanes.length ?? 0 };
    }
    case "graph":
      return data.graphView ? { shown: graphModelFor(data, state).rows.length, total: data.graphView.build(data.features).rows.length } : { shown: 0, total: 0 };
    case "quality":
      return { shown: applyFilters(data.features, state.filters).length, total: data.features.length };
    default:
      return { shown: overviewOf(data, state.filters).features.length, total: data.features.length };
  }
}

/**
 * The tabbed frame (feature 032, US-1/US-3): the tab bar, the shared filter line and the screen body, with the key row
 * leading with the tab keys (or shortened to "1-4 tab, ? help, q quit" on a narrow terminal). While typing, the filter
 * line shows the text and the key row says how to apply or cancel.
 */
function tabFramed(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState, rendered: string): string {
  const at = rendered.lastIndexOf("\n\n");
  const body = at >= 0 ? rendered.slice(0, at) : rendered;
  const hints = at >= 0 ? rendered.slice(at + 2) : "";
  const tab = tabOf(state);
  const f = state.filters;
  const typing = state.input !== null;
  const counts = tabCounts(data, state, tab);
  const filterLine = renderFilterLine(caps, {
    text: typing ? state.input! : (f.search ?? f.feature ?? ""),
    label: typing ? (state.searching ? "/" : "feature") : f.search || !f.feature ? "/" : "feature",
    typing,
    ...(f.status !== undefined ? { state: f.status } : {}),
    ...counts,
  });
  const footer = typing
    ? keyHints(caps, [[caps.unicode ? "⏎" : "enter", "apply"], ["esc", "cancel"]])
    : tabLayout(caps) === "narrow"
      ? keyHints(caps, [["1-4", "tab"], ["?", "help"], ["q", "quit"]])
      : `${keyHints(caps, [["1-4", "tab"], ["] [", "next/prev"]])}  ${hints}`;
  return `${renderTabFrame(caps, { active: tab, badges: tabBadges(data), filterLine, body })}\n\n${footer}`;
}

function renderScreen(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): { frame: string; screen: HelpScreen } {
  const u = caps.unicode;
  const move = u ? "↑↓" : "up/down";
  const enter = u ? "⏎" : "enter";
  const noticeMax = LIVE_TOKENS.limit["notice-max"];
  const presence = data.presence ? { presence: data.presence } : {};
  const nav = state.story;
  if (data.tabs && state.quality) {
    // Feature 032: the quality tab is the 024 view plus the FLOW panel (cycle time per phase, converge gap trend).
    const o = overviewOf(data, state.filters);
    const features = applyFilters(data.features, state.filters);
    const empty = !data.features.some((f) => f.coverage) && o.attention.length === 0;
    const base = empty ? tabEmptyBody(caps, "quality").join("\n") : renderQualityView(caps, features, o.attention);
    const body = [base, "", ...renderMetricsPanel(caps, data.metricsState)].join("\n");
    return { frame: `${body}\n\n${keyHints(caps, [["esc", "back"], ["/", "search"], ["s", "state"], ["?", "help"], ["q", "quit"]])}`, screen: "quality" };
  }
  if (state.view === "feature" && state.feature && nav) {
    const filters = { ...state.filters, feature: state.feature };
    const feature = applyFilters(data.features, filters)[0];
    const story = nav.stories[nav.cursor];
    if (feature && nav.mode === "detail" && story) {
      const dir = state.feature;
      const body = renderStoryDetail(caps, {
        feature,
        story,
        tasks: storyTasks(data.features, dir, story),
        meta: metaOf(caps, data, state),
        scroll: nav.scroll,
        maxTasks: DETAIL_MAX_TASKS,
        now: data.presence?.now ?? state.now,
        changedTasks: new Set([...state.changedTasks].filter((k) => k.startsWith(`${dir}/`)).map((k) => k.slice(dir.length + 1))),
        ...(data.presence?.byFeature.get(dir) ? { presence: data.presence.byFeature.get(dir)! } : {}),
      });
      return { frame: `${body}\n\n${keyHints(caps, [["esc", "back"], [move, "scroll tasks"], ["?", "help"], ["q", "quit"]])}`, screen: "story" };
    }
    if (feature) {
      const body = renderFeatureView(caps, {
        overview: overviewOf(data, filters),
        feature,
        meta: metaOf(caps, data, state),
        burndown: state.burndownReady ? data.burndownFor(filters) : "computing",
        storyCursor: nav.cursor,
        agentPanel: true,
        noticeMax,
        ...presence,
      });
      const hints = keyHints(caps, [["esc", "back"], [move, "move"], [enter, "story detail"], ["?", "help"], ["q", "quit"]]);
      return { frame: `${body}\n\n${hints}`, screen: "feature" };
    }
  }
  if (state.view === "fleet" && data.fleetView && state.fleet) {
    const api = data.fleetView;
    const lane = u ? "↑↓" : "up/down";
    const entry = data.tabs ? currentFleet(data.fleets) : null;
    if (data.tabs && state.fleetGroup && isGrouped(entry) && data.fleetTab) {
      // Feature 032 (FR-018): lanes grouped by feature across features, with 029 rows, confirm and directive rules inside.
      const rows = groupRows(entry, state.fleetGroup.collapsed, groupFilterOf(state));
      const body =
        rows.length === 0
          ? noMatchBody(caps, groupFilterOf(state).query).join("\n")
          : data.fleetTab.render(caps, {
              entry,
              rows,
              cursor: Math.min(state.fleetGroup.cursor, rows.length - 1),
              inner: state.fleet,
              selected: selectedFleetView(data, state),
              ...(state.live ? { live: state.live } : {}),
              now: state.now,
              window: api.windowRows(data.rows ?? 24, null),
            });
      const hints = keyHints(caps, [
        ["esc", "back"],
        [lane, "item"],
        [u ? "← →" : "left/right", "collapse"],
        ["p", "pause"],
        ["u", "continue"],
        ["x", "stop"],
        [u ? "⇧" : "shift", "whole run"],
        ["a", "approve"],
        ["?", "help"],
        ["q", "quit"],
      ]);
      return { frame: `${body}\n\n${hints}`, screen: "fleet" };
    }
    const run = visibleFleet(data, state);
    const body =
      data.tabs && !data.fleet
        ? tabEmptyBody(caps, "fleet").join("\n")
        : data.tabs && run && run.lanes.length === 0 && (data.fleet?.lanes.length ?? 0) > 0
          ? noMatchBody(caps, groupFilterOf(state).query).join("\n")
          : api.render(caps, {
              view: run,
              state: state.fleet,
              ...(state.live ? { live: state.live } : {}),
              now: state.now,
              rows: data.rows ?? 24,
            });
    const hints = keyHints(caps, [
      ["esc", "back"],
      [lane, "lane"],
      ["p", "pause"],
      ["u", "continue"],
      ["x", "stop"],
      [u ? "⇧" : "shift", "whole run"],
      ...(api.hasGates(run) ? ([["a", "approve"]] as [string, string][]) : []),
      ["?", "help"],
      ["q", "quit"],
    ]);
    return { frame: `${body}\n\n${hints}`, screen: "fleet" };
  }
  if (state.view === "graph" && data.graphView) {
    const model = graphModelFor(data, state);
    const everything = data.tabs ? data.graphView.build(data.features) : model;
    const body =
      data.tabs && everything.rows.length === 0 && everything.doneCount === 0
        ? tabEmptyBody(caps, "graph").join("\n")
        : data.tabs && model.rows.length === 0 && everything.rows.length > 0
          ? noMatchBody(caps, groupFilterOf(state).query).join("\n")
          : data.graphView.render(caps, model, state.graph?.cursor ?? 0);
    const hints = keyHints(caps, [["esc", "back"], [move, "move"], [enter, "open feature"], ["?", "help"], ["q", "quit"]]);
    return { frame: `${body}\n\n${hints}`, screen: "graph" };
  }
  const overview = overviewOf(data, state.filters);
  const body = renderOverview(caps, {
    overview,
    meta: metaOf(caps, data, state),
    burndown: state.burndownReady ? data.burndownFor(state.filters) : "computing",
    focus: { panel: state.focus, cursor: state.cursors[state.focus] },
    changed: state.changed,
    empty: emptyLines(caps, data, state.filters),
    noticeMax,
    ...presence,
  });
  const footer =
    state.input !== null && !data.tabs
      ? filterInput(caps, state.input, state.searching ? "search" : "filter")
      : keyHints(caps, [
          ["tab", "panel"],
          [move, "move"],
          [enter, "open"],
          ["f", "filter"],
          ["s", "status"],
          ...(data.graphView ? ([["g", "graph"]] as [string, string][]) : []),
          ...(data.fleetView ? ([["l", "fleet"]] as [string, string][]) : []),
          ["c", "quality"],
          ["?", "help"],
          ["q", "quit"],
        ]) + (data.tabs ? "" : filterNote(state.filters));
  return { frame: `${body}\n\n${footer}`, screen: "overview" };
}

/** Render the current frame, with the help overlay on top when it is open. */
export function renderOverviewTui(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): string {
  if (data.tabs) {
    const { frame, screen } = renderScreen(caps, data, state);
    const framed = tabFramed(caps, data, state, frame);
    return state.help ? renderHelp(caps, framed, screen, data.issues.map((i) => `${i.file}: ${i.reason}`)) : framed;
  }
  if (state.quality && state.view === "overview") {
    const o = overviewOf(data, state.filters);
    const hints = keyHints(caps, [["any key", "back"], ["q", "quit"]]);
    return `${renderQualityView(caps, applyFilters(data.features, state.filters), o.attention)}

${hints}`;
  }
  const { frame, screen } = renderScreen(caps, data, state);
  if (!state.help) return frame;
  return renderHelp(caps, frame, screen, data.issues.map((i) => `${i.file}: ${i.reason}`));
}

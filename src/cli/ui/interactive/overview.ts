import type { StoryProgress, TaskLine } from "../../../core/dashboard.js";
import type { FeatureSnapshot, Filters, ParseIssue } from "../../../core/overview-types.js";
import { applyFilters, computeOverview } from "../../../core/overview.js";
import type { BurndownState } from "../dashboard/burndown-chart.js";
import type { HeaderMeta } from "../dashboard/cards.js";
import { emptyState, noMatchLine } from "../dashboard/empty-state.js";
import { renderHelp, type HelpScreen } from "../dashboard/help-overlay.js";
import { liveIndicator, type LiveStatus } from "../dashboard/live-indicator.js";
import { LIVE_TOKENS } from "../dashboard/live-tokens.js";
import { renderFeatureView, renderOverview } from "../dashboard/render-overview.js";
import { DETAIL_MAX_TASKS, maxScroll, renderStoryDetail } from "../dashboard/story-detail.js";
import { TOKENS } from "../dashboard/tokens.js";
import { worktreeItems, type PresenceView } from "../dashboard/worktrees-panel.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import type { KeyEvent } from "./fullscreen.js";

/**
 * Interactive dashboard (features 014 and 017). Pure reducer + renderer over injected data; the
 * fullscreen host owns IO. Overview: `tab` cycles Attention → Up next → Worktrees & agents → Feature
 * completion and `⏎` opens the feature view; there `⏎` opens the story detail. `?` shows help on
 * every screen. Refreshed data arrives through `applyData`.
 */

export interface OverviewTuiData {
  features: FeatureSnapshot[];
  issues: ParseIssue[];
  meta: HeaderMeta;
  upNextCap: number;
  /** Burndown for a filter set (memoized by the command). */
  burndownFor: (filters: Filters) => BurndownState;
  /** Agent presence (feature 017); absent ⇒ no agent columns. */
  presence?: PresenceView;
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
  view: "overview" | "feature";
  focus: Panel;
  cursors: [number, number, number, number];
  filters: Filters;
  /** Feature-filter text being typed after `f`; null when not typing. */
  input: string | null;
  feature: string | null; // dir, in feature view
  story: StoryNav | null;
  /** Help overlay open (FR-030). */
  help: boolean;
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
    help: false,
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
  if (key.sequence === "?") return { ...state, help: true };
  if (state.view === "feature") return reduceFeature(data, state, key);

  switch (key.name) {
    case "q":
      return { ...state, done: true };
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
      return state.filters.feature || state.filters.status ? { ...state, filters: {}, cursors: NO_CURSORS } : state;
    case "f":
      return { ...state, input: state.filters.feature ?? "" };
    case "s": {
      const i = STATUS_CYCLE.indexOf(state.filters.status);
      const status = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
      return { ...state, filters: { ...state.filters, status }, cursors: NO_CURSORS };
    }
    default:
      return state;
  }
}

function reduceInput(state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  const text = state.input ?? "";
  if (key.name === "escape") return { ...state, input: null };
  if (key.name === "return" || key.name === "enter") {
    return { ...state, input: null, filters: { ...state.filters, feature: text || undefined }, cursors: NO_CURSORS };
  }
  if (key.name === "backspace") return { ...state, input: text.slice(0, -1) };
  const ch = key.sequence ?? "";
  if (!key.ctrl && ch.length === 1 && ch >= " " && ch <= "~") return { ...state, input: text + ch };
  return state;
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
  const parts = [filters.feature ? `feature=${filters.feature}` : "", filters.status ? `status=${filters.status}` : ""].filter(Boolean);
  return parts.length ? `  [${parts.join(" ")}]` : "";
}

const FILTER_FIELD = 36;

/** FilterInput (ui.md US-4): ` filter  ( 017▏          )   ⏎ apply  esc cancel` in the hint row. */
function filterInput(caps: Capabilities, value: string): string {
  const t = LIVE_TOKENS.component.input;
  const caret = caps.unicode ? t.caret.u : t.caret.a;
  const shown = value.length > FILTER_FIELD - 2 ? value.slice(-(FILTER_FIELD - 2)) : value;
  const field = paintToken(caps, t.fg, shown) + paintToken(caps, t["frame-fg"], caret) + " ".repeat(Math.max(0, FILTER_FIELD - 1 - shown.length));
  const frame = (s: string) => paintToken(caps, t["frame-fg"], s);
  return ` ${paintToken(caps, t["label-fg"], "filter")}  ${frame("(")} ${field}${frame(")")}   ${keyHints(caps, [[caps.unicode ? "⏎" : "enter", "apply"], ["esc", "cancel"]])}`;
}

function metaOf(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): HeaderMeta {
  return { ...data.meta, interactive: true, ...(state.live ? { live: liveIndicator(caps, state.live, state.now) } : {}) };
}

/** EmptyState for the interactive overview: no specs at all, or a filter that matches nothing. */
function emptyLines(caps: Capabilities, data: OverviewTuiData, filters: Filters): string[] {
  if (data.features.length === 0) {
    return emptyState(caps, "No feature specs yet.", { before: "Run ", command: "/amby.specify", after: " to create one." }, caps.columns);
  }
  return ["", noMatchLine(caps, [filters.feature, filters.status].filter(Boolean).join(" "))];
}

function renderScreen(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): { frame: string; screen: HelpScreen } {
  const u = caps.unicode;
  const move = u ? "↑↓" : "up/down";
  const enter = u ? "⏎" : "enter";
  const noticeMax = LIVE_TOKENS.limit["notice-max"];
  const presence = data.presence ? { presence: data.presence } : {};
  const nav = state.story;
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
    state.input !== null
      ? filterInput(caps, state.input)
      : keyHints(caps, [
          ["tab", "panel"],
          [move, "move"],
          [enter, "open"],
          ["f", "filter"],
          ["s", "status"],
          ["?", "help"],
          ["q", "quit"],
        ]) + filterNote(state.filters);
  return { frame: `${body}\n\n${footer}`, screen: "overview" };
}

/** Render the current frame, with the help overlay on top when it is open. */
export function renderOverviewTui(caps: Capabilities, data: OverviewTuiData, state: OverviewTuiState): string {
  const { frame, screen } = renderScreen(caps, data, state);
  if (!state.help) return frame;
  return renderHelp(caps, frame, screen, data.issues.map((i) => `${i.file}: ${i.reason}`));
}

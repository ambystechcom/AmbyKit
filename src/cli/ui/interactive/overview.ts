import type { FeatureSnapshot, Filters, ParseIssue } from "../../../core/overview-types.js";
import { applyFilters, computeOverview } from "../../../core/overview.js";
import type { BurndownState } from "../dashboard/burndown-chart.js";
import type { HeaderMeta } from "../dashboard/cards.js";
import { renderFeatureView, renderOverview } from "../dashboard/render-overview.js";
import { TOKENS } from "../dashboard/tokens.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import {
  initDashboardTui,
  reduceDashboard,
  renderDashboardTui,
  type DashboardTuiState,
  type TasksFor,
} from "./dashboard.js";
import type { KeyEvent } from "./fullscreen.js";

/**
 * Interactive overview (feature 014, ui.md "Interactive mode"). Pure reducer + renderer over
 * injected data; the fullscreen host owns IO. `tab` cycles Attention → Up next → Feature completion,
 * `⏎` opens the feature view, whose story list/detail is the existing 006 dashboard module.
 */

export interface OverviewTuiData {
  features: FeatureSnapshot[];
  issues: ParseIssue[];
  meta: HeaderMeta;
  upNextCap: number;
  /** Burndown for a filter set (memoized by the command). */
  burndownFor: (filters: Filters) => BurndownState;
}

export type Panel = 0 | 1 | 2;

export interface OverviewTuiState {
  view: "overview" | "feature";
  focus: Panel;
  cursors: [number, number, number];
  filters: Filters;
  /** Feature-filter text being typed after `f`; null when not typing. */
  input: string | null;
  feature: string | null; // dir, in feature view
  story: DashboardTuiState | null;
  burndownReady: boolean;
  done: boolean;
}

const STATUS_CYCLE: (string | undefined)[] = [undefined, "draft", "ready", "in-progress", "blocked", "done", "deferred"];

export function initOverviewTui(filters: Filters = {}): OverviewTuiState {
  return {
    view: "overview",
    focus: 0,
    cursors: [0, 0, 0],
    filters,
    input: null,
    feature: null,
    story: null,
    burndownReady: false,
    done: false,
  };
}

export function isOverviewDone(state: OverviewTuiState): boolean {
  return state.done;
}

function overviewOf(data: OverviewTuiData, filters: Filters) {
  return computeOverview(data.features, filters, { upNextCap: data.upNextCap }, data.issues);
}

/** Items in each focusable panel, for cursor bounds. */
function panelSizes(data: OverviewTuiData, state: OverviewTuiState): [number, number, number] {
  const o = overviewOf(data, state.filters);
  return [o.attention.length, o.upNext.items.length, o.features.length];
}

/** Open the feature view for `dir`, selecting the story whose display id is `storyId`. */
function openFeature(data: OverviewTuiData, state: OverviewTuiState, dir: string, storyId?: string): OverviewTuiState {
  const feature = applyFilters(data.features, { ...state.filters, feature: dir })[0];
  if (!feature) return state;
  const story = initDashboardTui(feature.stories);
  const idx = storyId ? feature.stories.findIndex((s) => s.displayId === storyId) : -1;
  return { ...state, view: "feature", feature: dir, story: { ...story, mode: "list", cursor: Math.max(0, idx) } };
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
  const row = o.features[cur];
  return row ? openFeature(data, state, row.name) : state;
}

function splitKey(key: string): [string, string] {
  const at = key.lastIndexOf(":");
  return [key.slice(0, at), key.slice(at + 1)];
}

/** Pure `(state, key) → state`. */
export function reduceOverviewTui(data: OverviewTuiData, state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  if (state.input !== null) return reduceInput(state, key);
  if (state.view === "feature") return reduceFeature(state, key);

  switch (key.name) {
    case "q":
      return { ...state, done: true };
    case "tab": {
      const step = key.shift ? 2 : 1;
      return { ...state, focus: ((state.focus + step) % 3) as Panel };
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
    case "f":
      return { ...state, input: state.filters.feature ?? "" };
    case "s": {
      const i = STATUS_CYCLE.indexOf(state.filters.status);
      const status = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
      return { ...state, filters: { ...state.filters, status }, cursors: [0, 0, 0] };
    }
    default:
      return state;
  }
}

function reduceInput(state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  const text = state.input ?? "";
  if (key.name === "escape") return { ...state, input: null };
  if (key.name === "return" || key.name === "enter") {
    return { ...state, input: null, filters: { ...state.filters, feature: text || undefined }, cursors: [0, 0, 0] };
  }
  if (key.name === "backspace") return { ...state, input: text.slice(0, -1) };
  const ch = key.sequence ?? "";
  if (!key.ctrl && ch.length === 1 && ch >= " " && ch <= "~") return { ...state, input: text + ch };
  return state;
}

function reduceFeature(state: OverviewTuiState, key: KeyEvent): OverviewTuiState {
  if (key.name === "q") return { ...state, done: true };
  const story = state.story;
  const back = key.name === "escape" || key.name === "backspace" || key.name === "left";
  if (!story || story.stories.length === 0 || (story.mode === "list" && back)) {
    return back ? { ...state, view: "overview", feature: null, story: null } : state;
  }
  return { ...state, story: reduceDashboard(story, key) };
}

function keyHints(caps: Capabilities, pairs: [string, string][]): string {
  const k = TOKENS.component["key-hints"];
  return pairs.map(([key, label]) => `${paintToken(caps, k["key-fg"], key)} ${paintToken(caps, k["label-fg"], label)}`).join("  ");
}

function filterNote(filters: Filters): string {
  const parts = [filters.feature ? `feature=${filters.feature}` : "", filters.status ? `status=${filters.status}` : ""].filter(Boolean);
  return parts.length ? `  [${parts.join(" ")}]` : "";
}

/** Render the current frame. */
export function renderOverviewTui(
  caps: Capabilities,
  data: OverviewTuiData,
  state: OverviewTuiState,
  tasksFor: TasksFor,
): string {
  const u = caps.unicode;
  if (state.view === "feature" && state.feature && state.story) {
    if (state.story.mode === "detail") return renderDashboardTui(caps, state.story, tasksFor);
    const filters = { ...state.filters, feature: state.feature };
    const feature = applyFilters(data.features, filters)[0];
    if (feature) {
      const body = renderFeatureView(caps, {
        overview: overviewOf(data, filters),
        feature,
        meta: { ...data.meta, interactive: true },
        burndown: state.burndownReady ? data.burndownFor(filters) : "computing",
        storyCursor: state.story.cursor,
      });
      return `${body}\n\n${keyHints(caps, [["esc", "back"], [u ? "↑↓" : "up/down", "move"], [u ? "⏎" : "enter", "story detail"], ["q", "quit"]])}`;
    }
  }
  const body = renderOverview(caps, {
    overview: overviewOf(data, state.filters),
    meta: { ...data.meta, interactive: true },
    burndown: state.burndownReady ? data.burndownFor(state.filters) : "computing",
    focus: { panel: state.focus, cursor: state.cursors[state.focus] },
  });
  const footer =
    state.input !== null
      ? `filter feature: ${state.input}${u ? "▌" : "_"}  ${keyHints(caps, [[u ? "⏎" : "enter", "apply"], ["esc", "cancel"]])}`
      : keyHints(caps, [
          ["tab", "panel"],
          [u ? "↑↓" : "up/down", "move"],
          [u ? "⏎" : "enter", "open"],
          ["f", "filter"],
          ["s", "status"],
          ["q", "quit"],
        ]) + filterNote(state.filters);
  return `${body}\n\n${footer}`;
}

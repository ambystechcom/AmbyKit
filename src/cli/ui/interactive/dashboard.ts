import type { Capabilities } from "../types.js";
import { paint, symbols } from "../theme.js";
import type { KeyEvent } from "./fullscreen.js";
import type { StoryProgress, TaskLine } from "../../../core/dashboard.js";

/**
 * Interactive dashboard view (US-6). Pure reducer + renderer; the fullscreen host owns IO. Navigate
 * the story list, open one to see its tasks, and quit — restoring the terminal (FR-013).
 */

export interface DashboardTuiState {
  stories: StoryProgress[];
  cursor: number;
  mode: "list" | "detail" | "done";
}

/** Lookup for a story's tasks, injected by the command (keeps the reducer/renderer pure). */
export type TasksFor = (story: StoryProgress) => TaskLine[];

const BAR_WIDTH = 10;
const RULE_MAX = 60;

export function initDashboardTui(stories: StoryProgress[]): DashboardTuiState {
  return { stories, cursor: 0, mode: stories.length > 0 ? "list" : "done" };
}

export function isDashboardDone(state: DashboardTuiState): boolean {
  return state.mode === "done";
}

/** Pure `(state, key) → state` navigation. */
export function reduceDashboard(state: DashboardTuiState, key: KeyEvent): DashboardTuiState {
  const n = state.stories.length;
  if (n === 0) return { ...state, mode: "done" };
  if (key.name === "q") return { ...state, mode: "done" };

  if (state.mode === "list") {
    switch (key.name) {
      case "up":
        return { ...state, cursor: (state.cursor - 1 + n) % n };
      case "down":
        return { ...state, cursor: (state.cursor + 1) % n };
      case "return":
      case "enter":
        return { ...state, mode: "detail" };
      default:
        return state;
    }
  }
  // detail mode
  switch (key.name) {
    case "left":
    case "escape":
    case "backspace":
      return { ...state, mode: "list" };
    default:
      return state;
  }
}

/** Render the current frame. */
export function renderDashboardTui(
  caps: Capabilities,
  state: DashboardTuiState,
  tasksFor: TasksFor,
): string {
  return state.mode === "detail" ? detailView(caps, state, tasksFor) : listView(caps, state);
}

function listView(caps: Capabilities, state: DashboardTuiState): string {
  const sym = symbols(caps);
  const rule = paint(caps, "muted", ruleChar(caps).repeat(ruleWidth(caps)));
  const rows = state.stories.map((s, i) => {
    const cursor = i === state.cursor ? paint(caps, "accent", sym.cursor) : " ";
    const id = `${s.featureRef} ${s.displayId}`.padEnd(10);
    const title = truncate(s.title, 24).padEnd(24);
    return `${cursor} ${id} ${title} ${bar(caps, s.tasksDone, s.tasksTotal)}  ${s.priority || "-"}`;
  });
  const hint = paint(caps, "muted", "↑/↓ move   enter open   q quit");
  return [title(caps, "AmbyKit · dashboard"), rule, ...rows, rule, hint].join("\n");
}

function detailView(caps: Capabilities, state: DashboardTuiState, tasksFor: TasksFor): string {
  const s = state.stories[state.cursor]!;
  const rule = paint(caps, "muted", ruleChar(caps).repeat(ruleWidth(caps)));
  const meta = paint(caps, "muted", `${s.status || "-"} · ${s.priority || "-"} · ${s.percent}%`);
  const lines = [
    title(caps, `AmbyKit · ${s.featureRef} ${s.displayId}`),
    rule,
    `${s.title}   ${meta}`,
    paint(caps, "muted", `depends-on: ${s.dependsOn.join(", ") || "-"}   blocked-by: ${s.blockedBy.join(", ") || "-"}`),
    "tasks:",
  ];
  const tasks = tasksFor(s);
  if (tasks.length === 0) lines.push(paint(caps, "muted", "  (none)"));
  for (const t of tasks) lines.push(`  [${t.done ? "x" : " "}] ${t.id} ${t.description}`);
  lines.push(rule, paint(caps, "muted", "←/esc back   q quit"));
  return lines.join("\n");
}

function title(caps: Capabilities, text: string): string {
  return paint(caps, "heading", text);
}

function bar(caps: Capabilities, done: number, total: number): string {
  const ratio = total > 0 ? done / total : 0;
  const pct = Math.round(ratio * 100);
  const filled = Math.round(ratio * BAR_WIDTH);
  const sym = symbols(caps);
  const style = pct >= 100 ? "success" : pct <= 0 ? "muted" : "accent";
  const b = sym.barFill.repeat(filled) + sym.barEmpty.repeat(BAR_WIDTH - filled);
  return `${paint(caps, style, b)} ${String(pct).padStart(3)}%`;
}

function ruleChar(caps: Capabilities): string {
  return caps.unicode ? "─" : "-";
}

function ruleWidth(caps: Capabilities): number {
  return Math.min(RULE_MAX, Math.max(20, caps.columns - 1));
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

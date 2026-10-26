import type { Presence } from "../../../core/activity.js";
import type { StoryProgress, TaskLine } from "../../../core/dashboard.js";
import type { FeatureSnapshot } from "../../../core/overview-types.js";
import { featureRow, statusOf } from "../../../core/overview.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { completionBar, header, sep, type HeaderMeta } from "./cards.js";
import { checkoutAgentLines } from "./feature-view.js";
import { featureLabel } from "./feature-chart.js";
import { layoutMode } from "./layout.js";
import { LIVE_TOKENS } from "./live-tokens.js";
import { glyph, panel, sideBySide, truncateVisible, visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * Story detail (feature 017, ui.md US-4 StoryDetail; replaces the 006 `detailView`): a one-line story
 * summary, then TASKS (scrollable, elided), RELATIONS (incl. the reverse `blocks`) and CHECKOUT &
 * AGENT. Wide puts the side panels right of TASKS; narrow stacks them; plain drops the frames.
 */

export interface StoryDetailView {
  feature: FeatureSnapshot;
  story: StoryProgress;
  tasks: TaskLine[];
  meta: HeaderMeta;
  /** First visible task (↑↓ scroll); clamped here. */
  scroll: number;
  /** Visible task rows before eliding (the screen height decides it). */
  maxTasks: number;
  presence?: Presence;
  now: number;
  /** Task ids checked by the last refresh (ChangedHighlight). */
  changedTasks?: ReadonlySet<string>;
}

const RIGHT_WIDTH = 36;

/** Task rows the detail shows before scrolling (elision markers count as rows). */
export const DETAIL_MAX_TASKS = 12;

/** Stories in the same feature that list `story` in their depends-on (the reverse edge). */
export function blocksOf(feature: FeatureSnapshot, story: StoryProgress): string[] {
  return feature.stories.filter((s) => s.dependsOn.includes(story.id) || s.dependsOn.includes(story.displayId)).map((s) => s.displayId);
}

/** Largest valid scroll offset: the list fits, or the last page shows the last task. */
export function maxScroll(total: number, maxTasks: number): number {
  return total <= maxTasks ? 0 : total - (maxTasks - 1);
}

function summary(caps: Capabilities, s: StoryProgress, width: number): string {
  const st = statusOf(s);
  const t = TOKENS.component["status-chart"][st];
  const status = paintToken(caps, t.fg, `${glyph(caps, t.symbol)} ${s.status || st}`);
  const counts = `${s.tasksDone} / ${s.tasksTotal}`;
  const bar = completionBar(caps, s.tasksTotal ? s.tasksDone / s.tasksTotal : null, 10);
  const right = `${status}${sep(caps)}${counts}${sep(caps)}${bar}`;
  const title = truncateVisible(caps, ` ${s.title}`, Math.max(8, width - visibleWidth(right) - 2));
  const gap = Math.max(2, width - visibleWidth(title) - visibleWidth(right));
  return paintToken(caps, TOKENS.semantic.color.text, title, true) + " ".repeat(gap) + right;
}

function taskLines(caps: Capabilities, view: StoryDetailView): string[] {
  const { tasks, story } = view;
  const muted = TOKENS.semantic.color.muted;
  if (tasks.length === 0) return [paintToken(caps, muted, `No tasks tagged [${story.displayId.replace("-", "")}] yet.`)];
  const a = TOKENS.component["artifact-item"];
  const line = (t: TaskLine): string => {
    const mark = t.done ? paintToken(caps, a.present.fg, glyph(caps, a.present.symbol)) : paintToken(caps, a.pending.fg, glyph(caps, a.pending.symbol));
    const changed = view.changedTasks?.has(t.id);
    const id = changed ? paintToken(caps, LIVE_TOKENS.component.live.changed.fg, t.id, true) : t.id;
    return `${mark} ${id}  ${t.description}`;
  };
  const max = Math.max(2, view.maxTasks);
  if (tasks.length <= max) return tasks.map(line);
  const scroll = Math.min(Math.max(0, view.scroll), maxScroll(tasks.length, max));
  const e = TOKENS.component.elision;
  const more = (n: number, where: string) => paintToken(caps, e.fg, `${glyph(caps, e.glyph)}  ${n} ${where}`);
  // Elision rows replace task rows, so the panel height stays put while scrolling.
  const top = scroll > 0 ? 1 : 0;
  const room = max - top;
  const fitsRest = tasks.length - scroll <= room;
  const shown = tasks.slice(scroll, scroll + (fitsRest ? room : room - 1));
  const below = tasks.length - scroll - shown.length;
  return [...(top ? [more(scroll, "above")] : []), ...shown.map(line), ...(below > 0 ? [more(below, "more")] : [])];
}

function relationLines(caps: Capabilities, view: StoryDetailView): string[] {
  const none = caps.unicode ? "—" : "-";
  const muted = TOKENS.semantic.color.muted;
  const row = (label: string, ids: string[]) => `${paintToken(caps, muted, label.padEnd(11))} ${ids.length ? ids.join(", ") : none}`;
  // Relations are stored canonical (`US1`); show them as the spec writes them (`US-1`).
  const shown = (ids: string[]) => ids.map((id) => view.feature.stories.find((s) => s.id === id)?.displayId ?? id);
  return [
    row("depends-on", shown(view.story.dependsOn)),
    row("blocked-by", shown(view.story.blockedBy)),
    row("blocks", blocksOf(view.feature, view.story)),
  ];
}

export function renderStoryDetail(caps: Capabilities, view: StoryDetailView): string {
  const { story, feature } = view;
  const label = featureLabel(featureRow(feature));
  const dot = caps.unicode ? " · " : " - ";
  const tasksTitle = `TASKS${dot}${story.tasksDone} of ${story.tasksTotal} done`;
  const agent = checkoutAgentLines(caps, feature, { ...(view.presence ? { presence: view.presence } : {}), now: view.now });

  if (layoutMode(caps) === "plain") {
    const plain = { ...caps, unicode: false, color: false };
    const lines = [
      `AmbyKit dashboard > ${label} > ${story.displayId}  ${story.priority || "-"}${view.meta.live ? `  ${view.meta.live}` : ""}`,
      `${story.title}  ${story.status || "-"}  ${story.tasksDone}/${story.tasksTotal}`,
      "",
      tasksTitle.replace(" · ", " - "),
      ...taskLines(plain, view).map((l) => `  ${l}`),
      "",
      "RELATIONS",
      ...relationLines(plain, view).map((l) => `  ${l}`),
      "",
      "CHECKOUT & AGENT",
      ...checkoutAgentLines(plain, feature, { ...(view.presence ? { presence: view.presence } : {}), now: view.now }).map((l) => `  ${l}`),
    ];
    return lines.join("\n");
  }

  const width = caps.columns;
  const meta = { ...view.meta, crumb: [label, story.displayId], right: story.priority || glyph(caps, TOKENS.component["summary-card"].empty) };
  const lines = [...header(caps, meta, width), summary(caps, story, width), ""];
  if (layoutMode(caps) === "narrow") {
    lines.push(
      ...panel(caps, { title: tasksTitle, width }, taskLines(caps, view)),
      ...panel(caps, { title: "RELATIONS", width }, relationLines(caps, view)),
      ...panel(caps, { title: "CHECKOUT & AGENT", width }, agent),
    );
    return lines.join("\n");
  }
  const gap = TOKENS.component.layout["panel-gap"];
  const left = width - gap - RIGHT_WIDTH;
  const right = [
    ...panel(caps, { title: "RELATIONS", width: RIGHT_WIDTH }, relationLines(caps, view)),
    ...panel(caps, { title: "CHECKOUT & AGENT", width: RIGHT_WIDTH }, agent),
  ];
  lines.push(...sideBySide([panel(caps, { title: tasksTitle, width: left }, taskLines(caps, view)), right], [left, RIGHT_WIDTH], gap));
  return lines.join("\n");
}

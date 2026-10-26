import type { Presence } from "../../../core/activity.js";
import type { AttentionItem, Clarification, FeatureSnapshot } from "../../../core/overview-types.js";
import { statusCounts, statusOf, storyLabel } from "../../../core/overview.js";
import { progressCell, renderTable } from "../table.js";
import { paintToken } from "../theme.js";
import type { Capabilities, Cell } from "../types.js";
import { agentBadge, checkoutBadge, phaseLabel, presenceLabel } from "./agent-badge.js";
import { glyph, panel, sideBySide } from "./panel.js";
import { statusBar } from "./status-chart.js";
import { TOKENS } from "./tokens.js";

/**
 * Feature drill-down (feature 014, ui.md US-5): ARTIFACTS, OPEN CLARIFICATIONS and STATUS panels,
 * then the existing story table with a `Waiting on` column.
 */

type ArtifactState = "present" | "partial" | "pending";

interface ArtifactLine {
  file: string;
  state: ArtifactState;
  detail: string;
}

export function artifactLines(f: FeatureSnapshot): ArtifactLine[] {
  const tasks = f.tasks;
  const done = tasks?.filter((t) => t.done).length ?? 0;
  const n = f.stories.length;
  return [
    { file: "spec.md", state: "present", detail: `${n} ${n === 1 ? "story" : "stories"}` },
    f.artifacts.ui
      ? { file: "ui.md", state: f.artifacts.uiSignedOff ? "present" : "partial", detail: f.artifacts.uiSignedOff ? "signed off" : "draft" }
      : { file: "ui.md", state: "pending", detail: "pending" },
    f.artifacts.plan ? { file: "plan.md", state: "present", detail: "" } : { file: "plan.md", state: "pending", detail: "pending" },
    tasks
      ? { file: "tasks.md", state: done === tasks.length ? "present" : "partial", detail: `${done} / ${tasks.length}` }
      : { file: "tasks.md", state: "pending", detail: "pending" },
  ];
}

function renderArtifacts(caps: Capabilities, f: FeatureSnapshot): string[] {
  const a = TOKENS.component["artifact-item"];
  return artifactLines(f).map((l) => {
    const t = a[l.state];
    const detail = paintToken(caps, TOKENS.semantic.color.muted, l.detail);
    return `${paintToken(caps, t.fg, glyph(caps, t.symbol))} ${l.file.padEnd(10)} ${detail}`.replace(/\s+$/, "");
  });
}

function renderClarifications(caps: Capabilities, items: Clarification[]): string[] {
  const n = TOKENS.component.notice;
  if (items.length === 0) return [paintToken(caps, TOKENS.semantic.color.muted, `None${caps.unicode ? " — " : " - "}spec fully clarified.`)];
  return items.map((c) => `${paintToken(caps, n.fg, glyph(caps, n.symbol))} L${c.line}  ${c.text}`);
}

function renderStatus(caps: Capabilities, f: FeatureSnapshot, width: number): string[] {
  const counts = statusCounts([f]);
  const s = TOKENS.component["status-chart"];
  const base = ["done", "in-progress", "draft", "blocked", "deferred"] as const;
  const extra = (["ready", "other"] as const).filter((k) => (counts[k] ?? 0) > 0);
  const legend = [...base, ...extra]
    .map((k) => `${paintToken(caps, s[k].fg, glyph(caps, s[k].symbol))} ${counts[k] ?? 0}`)
    .join("  ");
  return [legend, statusBar(caps, counts, Math.max(1, width))];
}

/** Agent context for the CHECKOUT & AGENT panel (feature 017). */
export interface AgentContext {
  presence?: Presence;
  now: number;
}

/** CHECKOUT & AGENT body (ui.md US-4): checkout badge, agent + phase, presence, then `also:` others. */
export function checkoutAgentLines(caps: Capabilities, f: FeatureSnapshot, ctx: AgentContext): string[] {
  const muted = TOKENS.semantic.color.muted;
  const lines = [checkoutBadge(caps, f.checkout)];
  const p = ctx.presence;
  if (!p) return [...lines, paintToken(caps, muted, "No agent reported")];
  const phase = phaseLabel(caps, p);
  lines.push(`${agentBadge(caps, p)}${phase ? "  " + phase : ""}`, presenceLabel(caps, p, ctx.now));
  const dot = caps.unicode ? " · " : " - ";
  for (const o of p.others) {
    lines.push(paintToken(caps, muted, "also: ") + agentBadge(caps, o) + paintToken(caps, muted, [o.phase, o.state].filter(Boolean).map((x) => dot + x).join("")));
  }
  return lines;
}

/** One line when the spec is clarified, else the full 014 panel (ui.md US-4 feature view). */
function clarificationsBlock(caps: Capabilities, f: FeatureSnapshot, width: number): string[] {
  const dot = caps.unicode ? " · " : " - ";
  const title = `OPEN CLARIFICATIONS${dot}${f.clarifications.length}`;
  if (f.clarifications.length === 0) {
    return [paintToken(caps, TOKENS.semantic.color.muted, ` ${title}${caps.unicode ? " — " : " - "}spec fully clarified.`)];
  }
  return panel(caps, { title, width }, renderClarifications(caps, f.clarifications));
}

/**
 * The three header panels: side by side when wide, stacked when narrow. With an agent context
 * (feature 017) CHECKOUT & AGENT takes the clarifications slot and clarifications move below.
 */
export function featurePanels(
  caps: Capabilities,
  f: FeatureSnapshot,
  width: number,
  mode: "wide" | "narrow",
  agent?: AgentContext,
): string[] {
  const dot = caps.unicode ? " · " : " - ";
  const clarTitle = `OPEN CLARIFICATIONS${dot}${f.clarifications.length}`;
  if (agent) {
    if (mode === "narrow") {
      return [
        ...panel(caps, { title: "ARTIFACTS", width }, renderArtifacts(caps, f)),
        ...panel(caps, { title: "CHECKOUT & AGENT", width }, checkoutAgentLines(caps, f, agent)),
        ...panel(caps, { title: "STATUS", width }, renderStatus(caps, f, width - 6)),
        ...clarificationsBlock(caps, f, width),
      ];
    }
    const w = Math.floor((width - 2) / 3);
    const last = width - 2 - 2 * w;
    return [
      ...sideBySide(
        [
          panel(caps, { title: "ARTIFACTS", width: w }, renderArtifacts(caps, f)),
          panel(caps, { title: "CHECKOUT & AGENT", width: w }, checkoutAgentLines(caps, f, agent)),
          panel(caps, { title: "STATUS", width: last }, renderStatus(caps, f, last - 6)),
        ],
        [w, w, last],
        1,
      ),
      ...clarificationsBlock(caps, f, width),
    ];
  }
  if (mode === "narrow") {
    return [
      ...panel(caps, { title: "ARTIFACTS", width }, renderArtifacts(caps, f)),
      ...panel(caps, { title: clarTitle, width }, renderClarifications(caps, f.clarifications)),
      ...panel(caps, { title: "STATUS", width }, renderStatus(caps, f, width - 6)),
    ];
  }
  const w = Math.floor((width - 2) / 3);
  const last = width - 2 - 2 * w;
  return sideBySide(
    [
      panel(caps, { title: "ARTIFACTS", width: w }, renderArtifacts(caps, f)),
      panel(caps, { title: clarTitle, width: w }, renderClarifications(caps, f.clarifications)),
      panel(caps, { title: "STATUS", width: last }, renderStatus(caps, f, last - 6)),
    ],
    [w, w, last],
    1,
  );
}

/** The existing story table filtered to the feature, plus `Waiting on` (FR-015). */
export function storyTable(
  caps: Capabilities,
  f: FeatureSnapshot,
  attention: AttentionItem[],
  width: number,
  cursor?: number,
): string[] {
  const s = TOKENS.component["status-chart"];
  const byKey = new Map(attention.map((a) => [a.key, a]));
  const none = glyph(caps, TOKENS.component["summary-card"].empty);
  const cursorGlyph = paintToken(caps, TOKENS.component.row["cursor-fg"], glyph(caps, TOKENS.component.row.cursor));
  const columns = [
    ...(cursor === undefined ? [] : [{ header: " ", min: 1, priority: 110 }]),
    { header: "ID", min: 4, priority: 100 },
    { header: "Title", min: 8, priority: 80 },
    { header: "Progress", min: 15, priority: 90 },
    { header: "Status", min: 6, priority: 70 },
    { header: "Prio", min: 4, priority: 40 },
    { header: "Waiting on", min: 6, priority: 30 },
  ];
  const rows: Cell[][] = f.stories.map((story, i) => {
    const st = statusOf(story);
    const waiting = byKey.get(storyLabel(f, story));
    return [
      ...(cursor === undefined ? [] : [i === cursor ? cursorGlyph : " "]),
      story.displayId,
      story.title,
      progressCell(story.tasksDone, story.tasksTotal),
      `${glyph(caps, s[st].symbol)} ${story.status || st}`,
      story.priority || none,
      waiting && waiting.refs.length > 0 ? waiting.refs.join(", ") : none,
    ];
  });
  return [paintToken(caps, TOKENS.semantic.color.text, "STORIES", true), ...renderTable(caps, { columns, rows, width }).split("\n")];
}

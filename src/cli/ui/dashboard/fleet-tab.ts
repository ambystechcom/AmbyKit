import type { FleetView } from "../../../core/fleet-view/types.js";
import { fleetGates, featureStateWord, type GroupRow } from "../../../core/fleet-view/group.js";
import type { FleetFeatureView, FleetsEntry } from "../../../core/fleet/fleet-view.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import type { FleetTuiState } from "../interactive/fleet.js";
import { iconGlyph, tabLayout } from "./layout.js";
import { laneLine, renderConfirm, stateGlyph } from "./fleet-view.js";
import { liveIndicator, type LiveStatus } from "./live-indicator.js";
import { glyph, panel, truncateVisible, visibleWidth } from "./panel.js";
import { TAB_TOKENS as T } from "./tab-tokens.js";
import { TOKENS } from "./tokens.js";

/**
 * The Fleet tab with lanes grouped by feature across features (feature 032, US-1, FR-018, ui.md "Grouping by feature").
 * 029's lane rows are reused unchanged; this adds the feature header rows (state, what a feature waits for or why it is
 * paused), the collapse marker and the GATES lines. Pure over `GroupRow[]`; the reducer and the effects live elsewhere.
 */

const NAME_WIDTH = 30;

export interface FleetTabInput {
  entry: FleetsEntry;
  /** Visible rows after the filter and the collapse (`groupRows`). */
  rows: GroupRow[];
  cursor: number;
  /** 029's slice: the confirm dialog, the notice and the gate cursor. */
  inner: FleetTuiState;
  /** The selected feature's 029 view, for the confirm dialog. */
  selected: FleetView | null;
  live?: LiveStatus;
  now: number;
  /** Rows the list may use (the terminal minus the fixed rows). */
  window: number;
}

const muted = (caps: Capabilities, s: string): string => paintToken(caps, TOKENS.semantic.color.muted, s);
const sep = (caps: Capabilities): string => (caps.unicode ? " · " : ", ");

/** The state badge for a feature: the shared glyph and word, or the word alone for a state the vocabulary has no glyph for. */
function stateBadge(caps: Capabilities, feature: FleetFeatureView): string {
  const word = featureStateWord(feature.state);
  const known = (T.semantic.state as Record<string, { glyph: { u: string; a: string }; word: string; fg: Parameters<typeof paintToken>[1] }>)[word];
  if (!known) return muted(caps, word.padEnd(8));
  return paintToken(caps, known.fg, `${stateGlyph(caps, word)} ${known.word}`.padEnd(10));
}

/** `waits for: 031-multi-feature-fleets (merging)`, `cause: … · holds 2`, or the lane count. */
function detail(caps: Capabilities, feature: FleetFeatureView): string {
  const s = sep(caps);
  if (feature.state === "paused") {
    const dependents = Math.max(0, (feature.affected?.length ?? 1) - 1);
    return `cause: ${feature.cause ?? "paused"}${s}holds ${dependents} dependent${dependents === 1 ? "" : "s"}`;
  }
  if (feature.state === "waiting") {
    const why = feature.waitsFor.map((w) => `${w.feature} (${w.why === "shared-files" ? "shared files" : "merging"})`).join(", ");
    return `waits for: ${why || (caps.unicode ? "—" : "-")}`;
  }
  if (feature.state === "done") return `${feature.lanes.length} of ${feature.lanes.length} lanes merged`;
  if (feature.state === "skipped") return "skipped";
  return `waits for: ${caps.unicode ? "—" : "-"}`;
}

function headerRow(caps: Capabilities, row: Extract<GroupRow, { kind: "feature" }>, selected: boolean): string {
  const cursor = selected ? glyph(caps, TOKENS.semantic.symbol.cursor) : " ";
  const mark = iconGlyph(caps, row.expanded ? T.component["fleet-feature"]["glyph-open"] : T.component["fleet-feature"]["glyph-closed"]);
  const name = truncateVisible(caps, row.feature.feature, NAME_WIDTH).padEnd(NAME_WIDTH);
  const collapsedNote = row.expanded ? "" : muted(caps, `  (${row.laneCount} lane${row.laneCount === 1 ? "" : "s"})`);
  return `${cursor} ${mark} ${paintToken(caps, T.component["fleet-feature"]["name-fg"], name, selected)} ${stateBadge(caps, row.feature)} ${paintToken(caps, T.component["fleet-feature"]["cause-fg"], detail(caps, row.feature))}${collapsedNote}`;
}

/** 029's lane row, indented under its feature header (the cursor column stays first). */
function laneRow(caps: Capabilities, row: Extract<GroupRow, { kind: "lane" }>, selected: boolean, compact: boolean): string {
  const line = laneLine(caps, row.lane, selected, compact ? "compact" : "wide");
  return `${line.slice(0, 2)}  ${line.slice(2)}`;
}

export function renderFleetTab(caps: Capabilities, input: FleetTabInput): string {
  const layout = tabLayout(caps);
  const compact = layout === "narrow";
  const { entry, rows, cursor } = input;
  const s = sep(caps);
  const live = input.live && !compact ? liveIndicator(caps, input.live, input.now) : "";
  const head = `FLEET${s}${entry.fleet}${s}${entry.features.length} features${s}caps ${entry.caps.total} total / ${entry.caps.perType} per type`;

  const at = Math.min(Math.max(0, cursor), Math.max(0, rows.length - 1));
  const win = Math.max(4, input.window);
  const start = Math.max(0, Math.min(at - Math.floor(win / 2), rows.length - win));
  const shown = rows.slice(start, start + win);
  const up = glyph(caps, { u: "↑", a: "^" });
  const down = glyph(caps, { u: "↓", a: "v" });
  const body = [
    ...(start > 0 ? [muted(caps, `  ${up} ${start} more`)] : []),
    ...shown.map((r, i) => (r.kind === "feature" ? headerRow(caps, r, start + i === at) : laneRow(caps, r, start + i === at, compact))),
    ...(start + shown.length < rows.length ? [muted(caps, `  ${down} ${rows.length - start - shown.length} more`)] : []),
  ];
  const gates = fleetGates(entry);
  const gateLines = gates.length === 0 ? [] : [muted(caps, "GATES"), ...gates.map((g) => paintToken(caps, TOKENS.semantic.color.warn, `  ${g.feature.replace(/^(\d+).*/, "$1")} ${g.id}${s}after ${g.after}${s}awaiting approval`))];
  const notice = input.inner.notice ? paintToken(caps, TOKENS.component.notice.fg, `${glyph(caps, TOKENS.component.notice.symbol)} ${input.inner.notice}`) : "";

  let frame: string;
  if (layout === "plain") {
    frame = [head + (live ? `  [${live}]` : ""), ...body.map((l) => l.trimEnd()), ...gateLines.map((l) => l.trimEnd())].join("\n");
  } else {
    const width = Math.min(Math.max(20, caps.columns), 120);
    const room = Math.max(8, width - 6 - (live ? visibleWidth(live) + 3 : 0));
    frame = panel(caps, { title: truncateVisible(caps, head, room), ...(live ? { right: live } : {}), width }, [...body, ...gateLines]).join("\n");
  }
  if (notice) frame += `\n${notice}`;
  if (input.inner.confirm && input.selected && layout !== "plain") return renderConfirm(caps, frame, input.selected, input.inner.confirm);
  return frame;
}

export interface FleetTabApi {
  render(caps: Capabilities, input: FleetTabInput): string;
}

export const fleetTabApi: FleetTabApi = { render: renderFleetTab };

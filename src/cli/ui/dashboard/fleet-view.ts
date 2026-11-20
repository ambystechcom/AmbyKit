import type { FleetView, GateView, LaneView, RunView } from "../../../core/fleet-view/types.js";
import { clampFleet, initFleetState, pendingGates, reduceFleet, scrollFor, type FleetIntent, type FleetTuiState } from "../interactive/fleet.js";
import { performFleetIntent, type FleetActionResult } from "../interactive/fleet-actions.js";
import type { KeyEvent } from "../interactive/fullscreen.js";
import { iconMode } from "../capabilities.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { agentBadge } from "./agent-badge.js";
import { FLEET_TOKENS as T } from "./fleet-tokens.js";
import { overlayOn } from "./help-overlay.js";
import { liveIndicator, type LiveStatus } from "./live-indicator.js";
import { glyph, panel, truncateVisible, visibleWidth } from "./panel.js";
import { TOKENS } from "./tokens.js";

/**
 * The Fleet view (feature 029, signed-off design in `specs/029-fleet-control-room/ui.md`). A pure renderer over
 * `FleetView` + the reducer slice's state + capabilities: no IO, no clock (the heartbeat advances `now`). Loaded
 * only on the interactive path, through a dynamic import that hands `overview.ts` the `FleetViewApi` below, so the
 * one-shot and `--json` paths never load it (FR-012). Layout tiers: **framed** on a terminal (compact under 60
 * columns), **plain** (no frame, ASCII words) when stdout is not a terminal. Every state is a word first; the glyph
 * only decorates it (FR-010).
 */

/** Spec 029 ui.md: under this many columns the assistant shrinks to its glyph and the tail is cut first. */
const COMPACT_MAX = T.space["fleet-narrow-max"];
const STATE_WORD_WIDTH = Math.max(...Object.values(T.word).slice(0, 7).map((w) => w.length));
const FIXED_ROWS = 9; // header, column row, panel edges, notice, blank, hints, margin
const LANE_PAD = T.space["fleet-lane-col"];
const ASSISTANT_PAD = T.space["fleet-assistant-col"];

export interface FleetRenderInput {
  view: FleetView | null;
  state: FleetTuiState;
  live?: LiveStatus;
  /** Epoch ms for the live indicator's "ago". */
  now: number;
  /** Terminal rows, for the scroll window. */
  rows: number;
}

type Mode = "wide" | "compact" | "plain";

function modeOf(caps: Capabilities): Mode {
  if (!caps.isTTY) return "plain";
  return caps.columns < COMPACT_MAX ? "compact" : "wide";
}

const sep = (caps: Capabilities): string => (caps.unicode ? " · " : ", ");
const dash = (caps: Capabilities): string => (caps.unicode ? T.text["directive-none"] : T.text["directive-none-ascii"]);
const muted = (caps: Capabilities, s: string): string => paintToken(caps, TOKENS.semantic.color.muted, s);

/** `working`, `QA round 1/3`, `architect round 2/3` (round 0 or an unset limit reads without a fraction). */
export function stageLabel(run: RunView, short = false): string {
  const n = run.limit > 0 ? `${run.round}/${run.limit}` : `${run.round}`;
  if (run.stage === "qa") return short ? `QA ${n}` : `QA round ${n}`;
  if (run.stage === "architect") return short ? `arch ${n}` : `architect round ${n}`;
  return "working";
}

/** The header text: run, phase, review stage, needs-a-decision and the number of other runs (words, never color alone). */
export function headerText(caps: Capabilities, view: FleetView, mode: Mode): string {
  const r = view.run;
  const s = sep(caps);
  const more = view.others.length > 0 ? `${s}+${view.others.length} more run${view.others.length === 1 ? "" : "s"}` : "";
  const need = r.needsDecision ? `${s}${T.component["fleet-header"]["needs-decision"].text}` : "";
  if (mode === "plain") return `FLEET ${r.run}  phase ${r.phase}  stage ${stageLabel(r)}${r.needsDecision ? `  ${T.word["needs-decision"]}` : ""}${more ? `  ${more.replace(s, "")}` : ""}`;
  if (mode === "compact") return `FLEET${s}ph ${r.phase}${s}${stageLabel(r, true)}${need}${more}`;
  return `FLEET${s}${r.run}${s}phase ${r.phase}${s}${stageLabel(r)}${need}${more}`;
}

type StateToken = (typeof T.component)["fleet-lane"]["state"]["working"];
const stateToken = (state: string): StateToken => (T.component["fleet-lane"].state as Record<string, StateToken>)[state] ?? T.component["fleet-lane"].state.unknown;

/** A state's glyph for the current icon mode; Nerd reuses the Unicode glyph (signed-off decision). */
export function stateGlyph(caps: Capabilities, state: string): string {
  const t = stateToken(state);
  const mode = iconMode(caps);
  return mode === "ascii" ? t.glyph.a : mode === "nerd" ? t.nerd.u : t.glyph.u;
}

/** `▶ working` (glyph, space, word padded to the longest state word), painted with the state's color. */
export function stateCell(caps: Capabilities, state: string, bold = false): string {
  const t = stateToken(state);
  return paintToken(caps, t.fg, `${stateGlyph(caps, state)} ${t.word.padEnd(STATE_WORD_WIDTH)}`, bold);
}

/** The DIRECTIVE words of 025's derivation; null when nothing is waiting on a directive. */
export function directiveText(l: LaneView): string | null {
  switch (l.directive.status) {
    case "pending":
      return `${l.directive.action} pending`;
    case "pause requested":
      return "pause requested";
    case "paused":
      return "paused";
    case "obeyed":
      return "obeyed";
    default:
      return null;
  }
}

const quiet = (l: LaneView): string => (l.idleMinutes === undefined ? "-" : `${l.idleMinutes}m`);

/** `STALLED 21m` (the text is the signal; color and weight only reinforce it, FR-005). */
export function stalledText(caps: Capabilities, l: LaneView): string {
  const t = T.component["fleet-lane"].stalled;
  return paintToken(caps, t.fg, `${t.text} ${quiet(l)}`, true);
}

const padTo = (s: string, n: number): string => s + " ".repeat(Math.max(0, n - visibleWidth(s)));

function badge(caps: Capabilities, l: LaneView, form: "full" | "glyph"): string {
  return agentBadge(caps, { agent: l.assistant, source: "reported" }, form);
}

function cursorCell(caps: Capabilities, selected: boolean): string {
  return selected ? glyph(caps, T.component["fleet-lane"].selected.cursor) : " ";
}

/** One lane row. `extras` (stalled text, directive words) come last so a narrow line cuts them before the state. */
export function laneLine(caps: Capabilities, l: LaneView, selected: boolean, mode: Mode, assistantWidth = ASSISTANT_PAD): string {
  const extras = [l.stalled ? stalledText(caps, l) : null, directiveText(l)].filter((x): x is string => x !== null);
  const tail = extras.length ? extras.join(sep(caps)) : muted(caps, dash(caps));
  const cur = cursorCell(caps, selected);
  const q = padTo(quiet(l), 5);
  if (mode === "compact") return `${cur} ${padTo(l.lane, LANE_PAD)} ${badge(caps, l, "glyph")} ${stateCell(caps, l.state, selected)} ${muted(caps, q)} ${tail}`;
  return `${cur} ${padTo(l.lane, LANE_PAD)} ${padTo(badge(caps, l, "full"), assistantWidth)} ${stateCell(caps, l.state, selected)} ${muted(caps, q)} ${tail}`;
}

function columnHeader(caps: Capabilities, mode: Mode, assistantWidth: number): string {
  if (mode === "compact") return muted(caps, `  ${padTo("LANE", LANE_PAD)} ${padTo("", 1)} ${padTo("STATE", STATE_WORD_WIDTH + 2)} ${padTo("QUIET", 5)} DIRECTIVE`);
  return muted(caps, `  ${padTo("LANE", LANE_PAD)} ${padTo("ASSISTANT", assistantWidth)} ${padTo("STATE", STATE_WORD_WIDTH + 2)} ${padTo("QUIET", 5)} DIRECTIVE`);
}

function gateLines(caps: Capabilities, gates: GateView[], gateCursor: number, mode: Mode): string[] {
  if (gates.length === 0) return [];
  const t = T.component["fleet-gate"];
  const pending = gates.filter((g) => g.state === "pending");
  const approved = gates.filter((g) => g.state === "approved").slice(-2);
  const shown = [...pending, ...approved];
  const lines = shown.map((g) => {
    const waiting = g.state === "pending";
    const text = `${g.id}${sep(caps)}after ${g.after}${sep(caps)}${waiting ? t.text : "approved"}`;
    const cur = pending.length > 1 && waiting && pending[gateCursor]?.id === g.id ? glyph(caps, T.component["fleet-lane"].selected.cursor) : " ";
    return `${cur} ${waiting ? paintToken(caps, t.pending.fg, text) : muted(caps, text)}`;
  });
  if (mode === "plain") return lines.map((l, i) => `${i === 0 ? "GATES: " : "       "}${l.trim()}`);
  return [muted(caps, "GATES"), ...lines];
}

/** Visible lane rows: what is left of the terminal after the fixed rows and the gate list. */
export function windowRows(termRows: number, view: FleetView | null): number {
  const gates = view ? Math.min(view.run.gates.length, 4) : 0;
  return Math.max(T.limit["fleet-rows-min"], termRows - FIXED_ROWS - (gates > 0 ? gates + 1 : 0));
}

function confirmLines(caps: Capabilities, view: FleetView, intent: FleetIntent): { title: string; body: string[] } {
  const words = { pause: "Pause", resume: "Continue", stop: "Stop" } as const;
  if (intent.kind === "approve") return { title: "APPROVE GATE", body: [`Approve ${intent.gate}?`] };
  const hint = "y confirm · n cancel".replace(" · ", sep(caps));
  if (intent.target.kind === "lane") {
    const lane = view.lanes.find((l) => l.lane === (intent.target as { lane: string }).lane);
    const who = lane ? `${intent.target.lane} (${badge(caps, lane, "full")})` : intent.target.lane;
    return { title: `${words[intent.kind].toUpperCase()} LANE`, body: [`${words[intent.kind]} ${who}?`, intent.kind === "stop" ? "The worker finishes its current task first." : "", hint].filter((x) => x !== "") };
  }
  const n = view.lanes.length;
  const note = intent.kind === "stop" ? "Each worker finishes its current task first." : intent.kind === "pause" ? "Each worker pauses at its next report." : "";
  return { title: `${words[intent.kind].toUpperCase()} ALL LANES`, body: [`${words[intent.kind]} all ${n} lane${n === 1 ? "" : "s"} of ${view.run.run}?`, note, hint].filter((x) => x !== "") };
}

export function renderConfirm(caps: Capabilities, frame: string, view: FleetView, intent: FleetIntent): string {
  const { title, body } = confirmLines(caps, view, intent);
  const widest = Math.max(...body.map(visibleWidth), visibleWidth(title)) + 4;
  const width = Math.min(caps.columns, Math.max(T.space["fleet-confirm-width"], widest));
  return overlayOn(caps, frame, panel(caps, { title, width, focused: true }, body));
}

/** The whole Fleet screen (without the key-hint row, which `overview.ts` adds with the other screens). */
export function renderFleet(caps: Capabilities, input: FleetRenderInput): string {
  const mode = modeOf(caps);
  const { view, state } = input;
  const notice = state.notice ? paintToken(caps, TOKENS.component.notice.fg, `${glyph(caps, TOKENS.component.notice.symbol)} ${state.notice}`) : "";
  // Compact terminals drop the live indicator: the header text (NEEDS A DECISION above all) is worth more than the "ago".
  const live = input.live && mode !== "compact" ? liveIndicator(caps, input.live, input.now) : "";

  if (!view) {
    const msg = "No fleet run is active.";
    const how = "Start one with `ambykit fleet start <feature>` or `ambykit run <feature>`.";
    if (mode === "plain") return ["FLEET", msg, how].join("\n");
    const lines = panel(caps, { title: "FLEET", ...(live ? { right: live } : {}), width: Math.min(caps.columns, 100) }, [msg, muted(caps, how)]);
    return [...lines, ...(notice ? [notice] : [])].join("\n");
  }

  const n = view.lanes.length;
  const win = windowRows(input.rows, view);
  const cursor = Math.min(state.cursor, Math.max(0, n - 1));
  const start = scrollFor(cursor, state.scroll, win, n);
  const end = Math.min(n, start + win);
  const up = glyph(caps, { u: "↑", a: "^" });
  const down = glyph(caps, { u: "↓", a: "v" });
  const assistantWidth = Math.min(20, Math.max(ASSISTANT_PAD, ...view.lanes.map((l) => visibleWidth(badge(caps, l, "full")))));
  const rows = view.lanes.slice(start, end).map((l, i) => laneLine(caps, l, start + i === cursor, mode, assistantWidth));
  const body = [
    ...(mode === "plain" ? [] : [columnHeader(caps, mode, assistantWidth)]),
    ...(start > 0 ? [muted(caps, `  ${up} ${start} more`)] : []),
    ...rows,
    ...(end < n ? [muted(caps, `  ${down} ${n - end} more`)] : []),
    ...gateLines(caps, view.run.gates, state.gateCursor, mode),
  ];

  let frame: string;
  if (mode === "plain") {
    const head = headerText(caps, view, mode) + (live ? `  [${live}]` : "");
    frame = [head, ...rows.map((r) => r.trimEnd()), ...gateLines(caps, view.run.gates, state.gateCursor, mode)].join("\n");
  } else {
    const width = Math.min(caps.columns, 120);
    const room = Math.max(8, width - 6 - (live ? visibleWidth(live) + 3 : 0));
    frame = panel(caps, { title: truncateVisible(caps, headerText(caps, view, mode), room), ...(live ? { right: live } : {}), width }, body).join("\n");
  }
  if (notice) frame += `\n${notice}`;
  if (state.confirm && mode !== "plain") return renderConfirm(caps, frame, view, state.confirm);
  if (state.confirm) {
    const { title, body: lines } = confirmLines(caps, view, state.confirm);
    frame += `\n${title}: ${lines.join(" ")}`;
  }
  return frame;
}

/**
 * What `overview.ts` is given after the dynamic import (the same pattern as 023's graph view): the pure reducer,
 * renderer and the one effect, so the one-shot path never imports any of them.
 */
export interface FleetViewApi {
  init(): FleetTuiState;
  reduce(view: FleetView | null, state: FleetTuiState, key: KeyEvent, rows: number): FleetTuiState;
  clamp(view: FleetView | null, state: FleetTuiState, rows: number): FleetTuiState;
  render(caps: Capabilities, input: FleetRenderInput): string;
  windowRows(termRows: number, view: FleetView | null): number;
  perform(root: string, view: FleetView, intent: FleetIntent): FleetActionResult;
  /** True when a gate is waiting, so the key row can offer `a approve`. */
  hasGates(view: FleetView | null): boolean;
}

export const fleetViewApi: FleetViewApi = {
  init: initFleetState,
  reduce: reduceFleet,
  clamp: clampFleet,
  render: renderFleet,
  windowRows,
  perform: (root, view, intent) => performFleetIntent(root, view, intent),
  hasGates: (view) => pendingGates(view).length > 0,
};

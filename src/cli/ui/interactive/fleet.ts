import type { FleetView, GateView } from "../../../core/fleet-view/types.js";
import type { KeyEvent } from "./fullscreen.js";

/**
 * Reducer slice for the Fleet view (feature 029, FR-001/006/008/009). Pure: it records an *intended action*
 * and the `interactive()` wrapper performs the write through `fleet-actions.ts`, the same split the overview
 * uses for `r`. It owns the lane cursor, the scroll offset, the gate cursor and the confirm dialog, and knows
 * nothing about drawing (that is T032, after the T022 design sign-off). Bindings are the plan's D3 defaults and
 * live in `FLEET_KEYS` so a sign-off change is one edit.
 */

export type FleetTarget = { kind: "lane"; lane: string } | { kind: "run"; run: string };

export type FleetIntent =
  | { kind: "pause" | "resume" | "stop"; target: FleetTarget }
  | { kind: "approve"; run: string; gate: string };

export interface FleetTuiState {
  cursor: number;
  scroll: number;
  gateCursor: number;
  /** An action waiting for `y`; any other key cancels it and nothing is written (FR-008). */
  confirm: FleetIntent | null;
  /** A confirmed action for the wrapper to perform, then clear with `clearIntent`. */
  intent: FleetIntent | null;
  /** One line of feedback ("lane-1-2 is already paused"), cleared by the next key. */
  notice: string | null;
  /** `esc`/`left`: back to the overview. */
  back: boolean;
  /** `q`: leave the dashboard. */
  quit: boolean;
}

export const FLEET_KEYS = {
  pause: "p",
  resume: "c",
  stop: "x",
  approve: "a",
  confirm: "y",
} as const;

export function initFleetState(): FleetTuiState {
  return { cursor: 0, scroll: 0, gateCursor: 0, confirm: null, intent: null, notice: null, back: false, quit: false };
}

export function clearIntent(state: FleetTuiState): FleetTuiState {
  return { ...state, intent: null };
}

/** Keep cursors inside the data after a refresh (a lane or a gate disappeared). */
export function clampFleet(view: FleetView | null, state: FleetTuiState, rows = 10): FleetTuiState {
  const n = view?.lanes.length ?? 0;
  const cursor = n === 0 ? 0 : Math.min(state.cursor, n - 1);
  const gates = pendingGates(view).length;
  return { ...state, cursor, scroll: scrollFor(cursor, state.scroll, rows, n), gateCursor: gates === 0 ? 0 : Math.min(state.gateCursor, gates - 1) };
}

export function pendingGates(view: FleetView | null): GateView[] {
  return view?.run.gates.filter((g) => g.state === "pending") ?? [];
}

/** The scroll offset that keeps `cursor` visible in a window of `rows`, never past the end. */
export function scrollFor(cursor: number, scroll: number, rows: number, total: number): number {
  const window = Math.max(1, rows);
  let s = scroll;
  if (cursor < s) s = cursor;
  if (cursor >= s + window) s = cursor - window + 1;
  return Math.max(0, Math.min(s, Math.max(0, total - window)));
}

const isUpper = (ch: string): boolean => ch.length === 1 && ch !== ch.toLowerCase();

export function reduceFleet(view: FleetView | null, state: FleetTuiState, key: KeyEvent, rows = 10): FleetTuiState {
  const base: FleetTuiState = { ...state, notice: null };

  if (state.confirm) {
    // Only `y` confirms; every other key cancels and writes nothing (FR-008).
    // The sequence wins over the name: Shift+Y reports name `y` but sequence `Y`, and a destructive action
    // needs a deliberate lowercase `y`.
    return (key.sequence ?? key.name) === FLEET_KEYS.confirm && !key.ctrl
      ? { ...base, confirm: null, intent: state.confirm }
      : { ...base, confirm: null };
  }
  if (key.ctrl && key.name === "c") return { ...base, quit: true };
  if (key.name === "q") return { ...base, quit: true };
  if (key.name === "escape" || key.name === "left" || key.name === "backspace") {
    // `left` also moves the gate cursor when several gates wait.
    if (key.name === "left" && pendingGates(view).length > 1) return { ...base, gateCursor: Math.max(0, state.gateCursor - 1) };
    return { ...base, back: true };
  }
  if (!view) return base;

  const lanes = view.lanes;
  if (key.name === "right" && pendingGates(view).length > 1) {
    return { ...base, gateCursor: Math.min(pendingGates(view).length - 1, state.gateCursor + 1) };
  }
  if (key.name === "up" || key.name === "down") {
    if (lanes.length === 0) return base;
    const cursor = Math.max(0, Math.min(lanes.length - 1, state.cursor + (key.name === "up" ? -1 : 1)));
    return { ...base, cursor, scroll: scrollFor(cursor, state.scroll, rows, lanes.length) };
  }

  const ch = key.sequence && key.sequence.length === 1 ? key.sequence : (key.name ?? "");
  const run = isUpper(ch) || key.shift === true;
  const letter = ch.toLowerCase();
  const lane = lanes[state.cursor];
  const target: FleetTarget | null = run ? { kind: "run", run: view.run.run } : lane ? { kind: "lane", lane: lane.lane } : null;

  if (letter === FLEET_KEYS.approve) {
    const gates = pendingGates(view);
    const gate = gates[Math.min(state.gateCursor, gates.length - 1)];
    if (!gate) return { ...base, notice: "No gate is waiting for approval." };
    return { ...base, intent: { kind: "approve", run: view.run.run, gate: gate.id } };
  }

  const action = letter === FLEET_KEYS.pause ? "pause" : letter === FLEET_KEYS.resume ? "resume" : letter === FLEET_KEYS.stop ? "stop" : null;
  if (!action) return base;
  if (!target) return { ...base, notice: "No lane is selected." };

  if (target.kind === "lane" && lane) {
    if (action === "pause" && lane.directive.action === "pause" && (lane.directive.status === "pause requested" || lane.directive.status === "paused")) {
      return { ...base, notice: `${lane.lane} is already ${lane.directive.status}.` };
    }
    if (action === "resume" && lane.directive.action === "continue" && lane.state !== "paused") {
      return { ...base, notice: `${lane.lane} is not paused.` };
    }
  }
  const intent: FleetIntent = { kind: action, target };
  // Stop and every whole-run action ask first (FR-008, D8); a plain lane pause or continue does not.
  return action === "stop" || target.kind === "run" ? { ...base, confirm: intent } : { ...base, intent };
}

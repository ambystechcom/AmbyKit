import type { LaneState } from "../activity.js";
import type { DirectiveAction, DirectiveStatus, RunGate, RunStage, RunStatus } from "../fleet/types.js";

/**
 * View-model for the dashboard's Fleet view (feature 029). Types only: built from spec 025's run record and
 * `laneStatus` result, with no state parsing and no stall rule of its own. Spec 025 owns the state
 * (`src/core/fleet/*`); 029 adds this read-only layer on top.
 */

/** A lane's state as shown: 025's states plus `unreported` (no report yet) and `unknown` (data unreadable, FR-003). */
export type LaneViewState = LaneState | "unreported" | "unknown";

/** The review loop's position (FR-004): working, QA or architect review. */
export type ReviewStage = RunStage;

export interface DirectiveView {
  action: DirectiveAction;
  /** 025's derived words; `none` when no directive is waiting. */
  status: DirectiveStatus;
}

export interface LaneView {
  /** Short lane name `lane-p-k`, unique in a run, so two lanes of one assistant stay distinct rows. */
  lane: string;
  assistant: string;
  state: LaneViewState;
  /** Spec 025's `laneStatus` decided this; the view never recomputes it (FR-005). */
  stalled: boolean;
  /** Whole minutes since the later of the last report and the last `tasks.md` change. */
  idleMinutes?: number;
  /** The stall limit in force, minutes (for the `STALLED 18m` text). */
  stallMinutes?: number;
  lastReportAt?: string;
  directive: DirectiveView;
  /** Task ids the run assigned to this lane. */
  tasks: string[];
}

export type GateView = RunGate;

export interface RunView {
  run: string;
  feature: string;
  status: RunStatus;
  phase: number;
  stage: ReviewStage;
  round: number;
  limit: number;
  needsDecision: boolean;
  gates: GateView[];
}

export interface FleetView {
  run: RunView;
  lanes: LaneView[];
  /** Other unfinished runs (ids), so the view can say there are more than the one shown. */
  others: string[];
  /** The reading time, epoch ms. */
  now: number;
}

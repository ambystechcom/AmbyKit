/**
 * Fleet state types (feature 025). The single contract the fleet family builds on: 019 (prompt layer),
 * 028 (`ambykit run`) and 029 (control room) import these and keep no run or state logic of their own.
 * Files and invariants are in `specs/025-mcp-server/data-model.md`.
 */

export const RUN_STATUSES = ["active", "paused", "waiting-person", "done"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STAGES = ["working", "qa", "architect"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

/** Unfinished runs are the ones a report can still belong to. */
export const UNFINISHED: readonly RunStatus[] = ["active", "paused", "waiting-person"];

export interface RunGate {
  id: string;
  after: string;
  state: "pending" | "approved";
}

/** Spec 019 US-7: how overlapping lanes are handled, recorded before work starts. */
export interface LaneOverlap {
  mode: "serialized" | "squad";
  /** Short names of the lanes this lane overlaps with. */
  with: string[];
  /** For a squad: which lane is the single writer of each shared path. */
  writers?: Record<string, string>;
  /** Merge order, short lane names. */
  mergeOrder?: string[];
}

export interface RunLane {
  /** Full lane name `NNN-slug.lane-p-k`. */
  lane: string;
  assistant: string;
  tasks: string[];
  /** Optional overlap-decision record (019 FR-019). */
  overlap?: LaneOverlap;
}

/** `.amby/fleet/<run>/run.json`. 019 writes phase/stage/round/limit/needsDecision; 028 gates/approvals/escalations/lanes. */
export interface RunRecord {
  run: string;
  feature: string;
  status: RunStatus;
  phase: number;
  stage: RunStage;
  round: number;
  limit: number;
  needsDecision: boolean;
  gates: RunGate[];
  lanes: RunLane[];
  approvals: unknown[];
  escalations: unknown[];
  createdAt: string;
}

export const DIRECTIVE_ACTIONS = ["continue", "pause", "stop"] as const;
export type DirectiveAction = (typeof DIRECTIVE_ACTIONS)[number];

/** `.amby/fleet/<run>/directives/<lane>.json`. */
export interface Directive {
  action: DirectiveAction;
  at: string; // ISO-8601
}

/** Derived, never stored (FR-022). `none` = no directive, or nothing is waiting on one. */
export type DirectiveStatus = "none" | "pending" | "pause requested" | "paused" | "obeyed";

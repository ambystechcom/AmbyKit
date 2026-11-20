import type { TaskLine } from "../dashboard.js";

/**
 * Fleet plan types (feature 031). Pure data: nothing here reads a file or starts a process. The shapes of
 * `FleetRecord` and `FleetFeature` are `specs/031-multi-feature-fleets/data-model.md`.
 */

/** What the planner needs to know about one feature, as read through spec 030's per-file reader. */
export interface FeatureModel {
  /** Directory name `NNN-slug`. */
  dir: string;
  /** Leading number (`031`), else the directory name. */
  ref: string;
  /** Spec frontmatter status (`draft | ready | in-progress | blocked | done`), `""` when absent. */
  status: string;
  /** Tasks with their declared `paths` and `pathIssue` (1.x trailing groups and 2.x `files` blocks give the same model). */
  tasks: TaskLine[];
  artifacts: { spec: boolean; plan: boolean; tasks: boolean };
  /** Prepared lane worktrees (`ambykit lane`): 0 means the fleet prepares them (clarification C-2). */
  lanes: number;
}

/** `feature` waits for `on`, declared by a feature-level `depends-on` or derived from a story edge (`NNN:US-#`). */
export interface DepEdge {
  feature: string;
  on: string;
  why: "depends-on" | "story-edge";
}

/** The files a feature may edit. `unknown` lists the open tasks with no usable ownership (FR-006). */
export interface Ownership {
  files: string[];
  unknown: string[];
}

export type WaitWhy = "depends-on" | "story-edge" | "shared-files";

export interface WaitsFor {
  feature: string;
  why: WaitWhy;
  /** The shared files behind a `shared-files` wait (FR-005); empty when the cause is unknown ownership. */
  files?: string[];
}

export type FleetFeatureState = "waiting" | "running" | "paused" | "done" | "skipped";

export interface FleetFeature {
  feature: string;
  /** `<feature>.<n>` once started; the directory is nested in `fleet-<n>/`. */
  run?: string;
  state: FleetFeatureState;
  waitsFor: WaitsFor[];
  /** The feature whose pause holds this one. */
  heldBy?: string;
  /** Why the feature is paused (a lane waiting for a person, a merge conflict before start), when it is. */
  cause?: string;
  ownership: Ownership;
  /** Hash of what the plan was made from (spec and tasks through the 030 reader, plus the ownership set). */
  fingerprint: string;
}

export type FleetStatus = "active" | "paused" | "waiting-person" | "done";

export interface FleetCaps {
  total: number;
  perType: number;
}

export interface FleetBudgets {
  wallClockMinutes: number;
  maxTasks: number;
  maxTokens?: number;
}

/** `.amby/fleet/fleet-<n>/fleet.json`. */
export interface FleetRecord {
  fleet: string;
  status: FleetStatus;
  createdAt: string;
  /** In planned start order. */
  features: FleetFeature[];
  caps: FleetCaps;
  budgets: FleetBudgets;
  unattended: boolean;
}

export interface Skipped {
  feature: string;
  reason: string;
}

/** What `buildFleetPlan` returns and the preview prints: every feature, its order and why it waits. */
export interface FleetPlan {
  features: FleetFeature[];
  caps: FleetCaps;
  budgets: FleetBudgets;
  skipped: Skipped[];
  /** Features whose lanes the fleet prepares before starting (clarification C-2), with the lane count. */
  prepare: { feature: string; lanes: number }[];
  /** Lanes already prepared per feature (0 for a feature in `prepare`). */
  laneCounts: Record<string, number>;
}

export type PlanError =
  | { kind: "not-found"; feature: string; message: string }
  | { kind: "not-ready"; feature: string; message: string }
  | { kind: "missing-dependency"; feature: string; on: string; message: string }
  | { kind: "cycle"; cycle: string[]; message: string }
  | { kind: "no-features"; message: string };

export type Planned<T> = { ok: true; value: T } | { ok: false; errors: PlanError[] };

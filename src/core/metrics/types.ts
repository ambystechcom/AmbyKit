// Workflow metrics from git history (feature 032, US-4). Local, zero model tokens, no network (FR-007, FR-016).

/** One historical version of a file: the commit, its time (unix seconds) and the text at that commit. */
export interface Revision {
  commit: string;
  time: number;
  text: string;
}

/** A commit that touched a file whose text is not needed (plan.md has no completed state to read). */
export interface Touch {
  commit: string;
  time: number;
}

/** Everything the metrics need about one feature, oldest first. */
export interface FeatureHistory {
  feature: string;
  spec: Revision[];
  plan: Touch[];
  tasks: Revision[];
}

export type MetricPhase = "spec" | "plan" | "tasks" | "converge";

/** Elapsed time of one phase of one feature. `completedAt`/`ms` are null while the phase is in progress. */
export interface PhaseCycle {
  feature: string;
  phase: MetricPhase;
  /** Epoch milliseconds. */
  startedAt: number;
  completedAt: number | null;
  ms: number | null;
}

/** One converge run: gap tasks appended per requirement. */
export interface GapPoint {
  feature: string;
  commit: string;
  /** Epoch milliseconds. */
  time: number;
  gapTasks: number;
  requirements: number;
  /** gapTasks / requirements, or null when the feature had no requirements. */
  rate: number | null;
}

export interface PhaseSummary {
  phase: MetricPhase;
  perFeature: PhaseCycle[];
  /** Median of the completed cycles, or null when none completed. */
  typicalMs: number | null;
}

export interface Metrics {
  phases: PhaseSummary[];
  gap: GapPoint[];
  /** Revisions that could not be read and were skipped (FR-019). */
  skipped: number;
  /** False when there is too little history to show numbers (FR-008). */
  enough: boolean;
  /** Why `enough` is false, for the panel and `--json`. */
  reason?: "not-a-repo" | "git-missing" | "too-little-history";
}

/** What the readers learn from one revision's text, through spec 030's per-file reader. */
export interface RevisionModel {
  /** spec.md: the feature status; tasks.md: undefined. */
  status?: string;
  /** spec.md: number of requirement lines. */
  requirements?: number;
  /** tasks.md: task counts. */
  tasks?: { total: number; done: number };
  /** tasks.md: gap tasks (closing a requirement) and how many are checked. */
  gap?: { total: number; done: number };
  /** The text could not be read. */
  unreadable?: boolean;
}

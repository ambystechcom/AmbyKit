import type { StoryProgress, TaskLine } from "./dashboard.js";

/**
 * Value objects for the dashboard overview (feature 014). Plain and IO-free; produced by
 * `features.ts`/`overview.ts`/`burndown.ts`, consumed by the renderers and `--json --overview`.
 * See specs/014-enhanced-dashboard/data-model.md.
 */

export type Status = "done" | "in-progress" | "ready" | "draft" | "blocked" | "deferred" | "other";

/** Fixed display order for status counts and chart segments. */
export const STATUS_ORDER: readonly Status[] = [
  "done",
  "in-progress",
  "ready",
  "draft",
  "blocked",
  "deferred",
  "other",
];

export type Phase = "specified" | "designed" | "planned" | "tasked" | "implementing" | "done";

/** A file the dashboard could not read or parse; skipped, and named in the output (FR-014). */
export interface ParseIssue {
  file: string; // project-relative, e.g. "specs/003-x/tasks.md"
  reason: string;
}

/** An open `[NEEDS CLARIFICATION: …]` marker in a spec. */
export interface Clarification {
  line: number; // 1-based
  text: string;
}

/**
 * Where a feature's artifacts were read from (feature 017). `main` is the primary checkout and
 * carries no git state, so projects without worktrees render exactly as before (FR-008).
 */
export interface Checkout {
  root: string; // absolute checkout path
  kind: "main" | "worktree";
  branch?: string;
  dirty?: boolean;
  stale?: boolean; // branch merged into the default branch since it diverged
}

/** Everything the dashboard knows about one `specs/NNN-slug/` directory. */
export interface FeatureSnapshot {
  /** Source checkout (feature 017); absent ≡ the primary checkout. */
  checkout?: Checkout;
  dir: string; // "014-enhanced-dashboard"
  ref: string; // featureRefOf(dir); may collide across features
  displayRef: string; // ref, or dir when ref collides (unique)
  stories: StoryProgress[]; // tasks applied
  tasks: TaskLine[] | null; // null = no tasks.md
  artifacts: { spec: boolean; ui: boolean; uiSignedOff: boolean; plan: boolean; tasks: boolean };
  clarifications: Clarification[];
}

export interface Filters {
  feature?: string; // matches ref or dir
  status?: string;
}

export interface OverviewOptions {
  upNextCap: number;
}

export interface Summary {
  features: number;
  featuresDone: number;
  stories: number;
  storiesDone: number;
  tasksDone: number;
  tasksTotal: number;
  percent: number | null; // null when there are no tasks
}

export interface FeatureRow {
  ref: string;
  name: string;
  tasks: { done: number; total: number } | null;
  percent: number | null;
  phase: Phase;
  clarifications: number;
  /** Source worktree (feature 017); absent for the primary checkout. */
  checkout?: Checkout;
}

export interface AttentionItem {
  key: string;
  kind: "graph-problem" | "blocked" | "waiting";
  refs: string[];
  reason: string;
}

export interface UpNextItem {
  taskId: string;
  storyKey: string | null;
  description: string;
  feature: string;
}

export interface Overview {
  summary: Summary;
  statusCounts: Partial<Record<Status, number>>; // zero entries omitted
  features: FeatureRow[];
  attention: AttentionItem[];
  upNext: { items: UpNextItem[]; eligible: number; allDone: boolean };
  issues: ParseIssue[];
}

export interface BurndownPoint {
  periodStart: string; // ISO date
  total: number;
  remaining: number;
}

export interface Burndown {
  status: "ready" | "no-history";
  reason?: "not-a-repo" | "git-missing" | "too-little-history";
  period?: "daily" | "weekly" | "monthly";
  points: BurndownPoint[]; // oldest → newest; last = working tree
  deltaRemaining?: number;
}

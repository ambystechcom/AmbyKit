# Data model — 014 Enhanced dashboard

Plain, IO-free value objects produced by `src/core` and consumed by renderers and `--json --overview`.
`StoryProgress` and `TaskLine` (`src/core/dashboard.ts`) are reused unchanged.

## Entities

```ts
type Status = "done" | "in-progress" | "ready" | "draft" | "blocked" | "deferred" | "other";
type Phase  = "specified" | "designed" | "planned" | "tasked" | "implementing" | "done";

interface ParseIssue { file: string; reason: string }            // FR-014

interface FeatureSnapshot {                                        // features.ts
  dir: string;              // "014-enhanced-dashboard"
  ref: string;              // featureRefOf(dir), may collide
  displayRef: string;       // ref, or dir when ref collides (I-5)
  stories: StoryProgress[]; // tasks applied
  tasks: TaskLine[] | null; // null = no tasks.md
  artifacts: { spec: boolean; ui: boolean; uiSignedOff: boolean; plan: boolean; tasks: boolean };
  clarifications: { line: number; text: string }[];               // R-1
}

interface Filters { feature?: string; status?: string }
interface OverviewOptions { upNextCap: number }                   // R-4

interface Overview {                                               // overview.ts
  summary: { features: number; featuresDone: number; stories: number; storiesDone: number;
             tasksDone: number; tasksTotal: number; percent: number | null };   // null when 0 tasks
  statusCounts: Partial<Record<Status, number>>;                  // zero entries omitted
  features: FeatureRow[];
  attention: AttentionItem[];
  upNext: { items: UpNextItem[]; eligible: number; allDone: boolean };
  issues: ParseIssue[];
}
interface FeatureRow { ref: string; name: string; tasks: { done: number; total: number } | null;
                       percent: number | null; phase: Phase; clarifications: number }
interface AttentionItem { key: string; kind: "graph-problem" | "blocked" | "waiting";
                          refs: string[]; reason: string }
interface UpNextItem { taskId: string; storyKey: string | null; description: string; feature: string }

interface BurndownPoint { periodStart: string; total: number; remaining: number }  // ISO date
interface Burndown {                                               // burndown.ts
  status: "ready" | "no-history";
  reason?: "not-a-repo" | "git-missing" | "too-little-history";
  period?: "daily" | "weekly" | "monthly";
  points: BurndownPoint[];  // oldest → newest; last = working tree
  deltaRemaining?: number;  // last − previous
}
```

## Invariants (each has a unit test)

- **I-1** `summary.storiesDone ≤ summary.stories`; `tasksDone ≤ tasksTotal`; `percent =
  round(100·done/total)`, `null` iff `tasksTotal = 0`.
- **I-2** `Σ statusCounts = summary.stories`. Empty or unknown status → `other`.
- **I-3** Every feature in the filtered set appears exactly once in `features`, ordered by numeric
  ref then dir name.
- **I-4** Attention: graph problems first, then blocked, then waiting; a story appears at most once,
  in its highest-ranked kind. `blocked` = status `blocked` or a `blocked-by` target not `done` (done blockers dropped from `refs`); `waiting` =
  any `depends-on` target (resolved with `resolveDepKey`) not `done`. Done stories never appear.
- **I-5** `displayRef` values are unique across the project.
- **I-6** `upNext.items` ⊆ undone tasks whose story is not in `attention` (unassigned tasks
  allowed); length ≤ `upNextCap`; `eligible` counts all candidates; `allDone` iff no undone task
  exists in the filtered set.
- **I-7** Phase is the furthest step reached (ui.md US-5 PhaseLabel); `done` requires every story
  done; missing `ui.md` never blocks later phases.
- **I-8** Burndown: `remaining ≤ total` per point; points strictly increase by period; `status =
  "no-history"` ⇒ `points = []`; filters scope the history to the same stories as the overview.
- **I-9** Filters are applied before every aggregate (FR-011); `feature` matches `ref` or `dir`.

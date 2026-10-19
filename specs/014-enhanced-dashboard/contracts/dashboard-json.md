# Contract — `ambykit dashboard --json [--overview]`

## `--json` (unchanged)

Exactly `JSON.stringify(computeDashboard(root) /* filtered */, null, 2)` — an array of
`StoryProgress`. Byte-identical to 1.1.x (SC-005, `test/cli/dashboard-json.test.ts`).

## `--json --overview` (new, FR-012 per R-5)

One JSON object, 2-space indented, no ANSI, exit 0. Field names match the widget names in `ui.md`;
types are those in `data-model.md`.

```jsonc
{
  "stories": [ /* identical to bare --json output */ ],
  "summary":      { "features": 3, "featuresDone": 1, "stories": 10, "storiesDone": 4,
                    "tasksDone": 25, "tasksTotal": 40, "percent": 63 },
  "statusCounts": { "done": 4, "in-progress": 3, "draft": 2, "blocked": 1 },
  "features":     [ { "ref": "001", "name": "core", "tasks": { "done": 10, "total": 10 },
                      "percent": 100, "phase": "done", "clarifications": 0 } ],
  "attention":    [ { "key": "002:US-3", "kind": "blocked", "refs": ["US-2"], "reason": "blocked-by US-2" } ],
  "upNext":       { "items": [ { "taskId": "T012", "storyKey": "002:US-1", "description": "…", "feature": "002-x" } ],
                    "eligible": 7, "allDone": false },
  "burndown":     { "status": "ready", "period": "weekly", "points": [ { "periodStart": "2026-08-10", "total": 100, "remaining": 96 } ],
                    "deltaRemaining": -7 },
  "issues":       [ { "file": "specs/003-y/tasks.md", "reason": "…" } ],
  "filters":      { "feature": null, "status": null, "next": 5 }
}
```

Rules:
- `--feature`, `--status`, `--next` apply to every member (FR-011); `stories` is filtered exactly as
  bare `--json` is today.
- `burndown` is `{ "status": "no-history", "reason": "…", "points": [] }` when unavailable (FR-019).
- New members may be added later; existing members never change meaning (FR-012).

# Data model — 017-live-dashboard

## Checkout
`{ root: string; kind: "main" | "worktree"; branch?: string; dirty?: boolean; stale?: boolean }` — optional on snapshots; absent ≡ main.
- Invariant: `kind === "main"` ⇒ `branch`, `dirty` and `stale` are absent (keeps FR-008 output identical).
- `root` is the absolute checkout path; used for tasks, burndown, markers.

## FeatureSnapshot (014, extended)
`+ checkout?: Checkout` (absent ≡ primary checkout, so 014 fixtures stay valid)
- Invariant: at most one snapshot per feature dir after `mergeCheckouts`. The worktree copy wins
  only for the worktree's own feature id (FR-002/003).

## ActivityMarker — `<checkout>/.amby/activity/<feature>.<agent>.json`
`{ agent: string; phase: string; task?: string; at: string /* ISO-8601 */; pid?: number }`
- `agent` is an emit-target id. Unknown ids are kept and rendered with the generic badge (FR-026).
- A corrupt or partial file is ignored (edge case).
- A future `at` is clamped to `now` when classified.

## Presence
`{ agent: string; source: "reported" | "detected"; phase?: string; task?: string; state: "active" | "idle" | "stale"; since: Date; others: Presence[] }`
- `since = max(marker.at, tasks.md mtime)` for reported presence.
- Classification uses the thresholds from config or the tokens (FR-021).

## AgentProcess (scan result, interactive only)
`{ pid: number; agent: string; cwd: string | null }`
- `cwd === null` ⇒ the process goes to `unlocated` and is never attributed to a feature (FR-023).

## LiveState (interactive)
`{ mode: "watching" | "polling" | "paused"; lastChange: Date; changed: Set<string> }`
- `changed` holds feature dirs and task ids from the last refresh. It is cleared on the next heartbeat.

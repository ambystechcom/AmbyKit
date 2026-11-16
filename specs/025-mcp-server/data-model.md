# Data model — 025-mcp-server

Files and invariants only. Technology choices are in `plan.md`.

## Activity marker (extends 017; `src/core/activity.ts`)

Per checkout, `.amby/activity/<feature>.<agent>.json`, or with a lane
`<feature>.<agent>~<lane>.json` where `<lane>` is the short form `lane-<phase>-<k>`.

| Field | Type | Notes |
|---|---|---|
| `agent` | string | tool id, as today; readers take it from the body, not the file name |
| `phase` | string | as today |
| `task?` | string | `T###`, as today |
| `at` | ISO-8601 | as today |
| `pid?` | number | as today |
| `lane?` | string | full lane name `NNN-slug.lane-p-k` |
| `state?` | `working \| waiting \| blocked \| paused \| done` | absent ⇒ treated as `working` |
| `run?` | string | run id the report belongs to |

Invariants: a marker without the new fields is byte-identical to today's; progress is never stored.

## Fleet state contract (owned by this spec)

025 owns all fleet state code under `src/core/fleet/*` (runs, directives, claims, notes, lane-status,
types) and everything under `.amby/fleet/<run>/` in the primary checkout (`primaryRoot`). Specs 019
(CLI and prompt layer, incl. a thin `ambykit fleet` wrapper), 028 and 029 only import from it; none keeps
its own run-id or state logic. This is the single contract the other fleet specs build against.

## Run record (`.amby/fleet/<run>/run.json`, owned by this spec)

```
{ run, feature,
  status: active | paused | waiting-person | done,
  phase, stage: working | qa | architect, round, limit, needsDecision,
  gates: [{ id, after, state: pending | approved }],
  lanes: [{ lane, assistant, tasks[], overlap?: { mode: serialized | squad, with[], writers?{path: lane}, mergeOrder?[] },
            restarts?: number, done?: boolean }],
  approvals[], escalations[], createdAt }
```

Unfinished = `active | paused | waiting-person`. `<run>` is `<feature>.<n>` and a run is created only on
explicit request (spec 019 FR-014); there is no implicit run. Writers go through this module's
`createRun` and `updateRun`: 019 writes `phase`, `stage`, `round`, `limit`, `needsDecision` and, per lane, `restarts` and `done`; 028 writes
`gates`, `approvals`, `escalations` and `lanes`; 029 only reads.

## Review verdicts (owned by spec 019)

`.amby/fleet/<run>/verdicts/<lane>.<role>.<round>.json`:
`{ verdict: pass|fail, findings: [{ id, severity, finding, fix }] }`. Listed here for the path only; 019
defines the contract.

## Directive

`.amby/fleet/<run>/directives/<lane>.json`: `{ "action": "continue|pause|stop", "at": ISO-8601 }`.
Last write wins; a missing file means continue. Lane names are validated against the run's lanes.
`<lane>` in every file name (directives and activity markers) is the SHORT lane form `lane-<p>-<k>`; the
full name `NNN-slug.lane-p-k` is stored in the body only. `writeDirective` and the verb
`ambykit directive` are owned here; 019's wrapper, 028 and 029 call `writeDirective`. Gate approval is
not a directive: it is owned by 028 and changes `gates[]` through `updateRun`.

Lane state `paused` is set when a lane's next report after a `pause` directive says so; derivation
below.

Derived directive status (never stored): `pause requested`, `paused`, `pending`, `obeyed` per FR-022.

## Claims

`.amby/fleet/<run>/claims.json`: `{ "<normalized path>": { "worker": string, "task": "T###", "at": ISO } }`.
A claim conflicts when `overlaps()` (lanes.ts) says the paths overlap. All of a task's claims are
released together when that task is ticked (`tickTask`). 019's `fleet claim|release|note` wrap this
store; nothing else writes it.

## Notes

`.amby/fleet/<run>/notes.log`, one line per note: `T### | <comma-separated files or -> | <text>`. Text has
no newline; a line that does not match is refused. This is the only notes file and format.

## Config additions (`.amby/config.json`)

One `fleet` object for the whole fleet family. 025 owns the schema and the defaults; 028 extends it.

```
mcp?:   { enabled: boolean }
fleet?: { stallMinutes: 15, restartLimit: 2,
          concurrency: { total: 3, perType: 2 },
          roundLimit: 3, tickSeconds, budgets: {...}, workerModel }
```

`laneStatus` (this spec) is the single per-lane stall implementation (state working, no report and no
`tasks.md` change for `fleet.stallMinutes`); 019, 028 and 029 call it and keep no stall logic of their own.

## Locks

`.amby/locks/<name>.lock`: exclusive-create lockfile with owner pid and time; stale after 30 s; callers
retry briefly and then return a warning, never hang.

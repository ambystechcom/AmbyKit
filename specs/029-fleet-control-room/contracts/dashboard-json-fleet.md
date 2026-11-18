---
feature: 029-fleet-control-room
created: 2026-11-18
---

# Contract — `fleet` in `dashboard --json --overview`

Feature 029 (FR-012, FR-013). Extends `specs/014-enhanced-dashboard/contracts/dashboard-json.md` and 017's additions.
Fields are only ever **added**, never removed or renamed.

## When it appears

- `ambykit dashboard --json --overview` carries a top-level `fleet` object **only when a fleet run exists** (an unfinished run
  under `.amby/fleet/`, spec 025). With no run the key is absent and the document is byte-identical to before.
- Bare `--json` (a story array), the one-shot text and every other flag are unchanged.
- The run shown is the most recently created unfinished run; other unfinished runs are listed in `others`.

## Shape

```json
{
  "fleet": {
    "run": "019-amby-run-prompt.1",
    "feature": "019-amby-run-prompt",
    "status": "active",
    "phase": 2,
    "stage": "qa",
    "round": 1,
    "limit": 3,
    "needsDecision": false,
    "gates": [{ "id": "phase-2", "after": "US-3", "state": "pending" }],
    "lanes": [
      {
        "lane": "lane-2-1",
        "assistant": "claude",
        "state": "working",
        "stalled": false,
        "lastActivity": "2026-11-16T12:00:00.000Z",
        "idleMinutes": 1,
        "directive": { "action": "continue", "status": "none" }
      }
    ],
    "others": []
  }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `run`, `feature` | string | The run id (`<feature>.<n>`) and its feature directory. |
| `status` | `active \| paused \| waiting-person \| done` | 025's run status (an unfinished run is never `done`). |
| `phase`, `round`, `limit` | number | Current phase, review round and round limit (0 when not recorded). |
| `stage` | `working \| qa \| architect` | Review-loop position; `working` when not recorded. Run-level. |
| `needsDecision` | boolean | The lead stopped and needs a person. |
| `gates[]` | `{ id, after, state }` | 028's story-checkpoint gates; `state` is `pending` or `approved`. |
| `lanes[].lane` | string | Short lane name `lane-<p>-<k>`. |
| `lanes[].state` | `working \| waiting \| blocked \| paused \| done \| unreported \| unknown` | The lane's last reported state; `unreported` = not reported yet, `unknown` = unreadable. |
| `lanes[].stalled` | boolean | 025's `laneStatus`: a working lane with no report and no `tasks.md` change for `fleet.stallMinutes`. |
| `lanes[].lastActivity` | ISO string, optional | The lane's latest report; absent when it has not reported. |
| `lanes[].idleMinutes` | number, optional | Whole minutes since the later of the report and the last `tasks.md` change; never negative. |
| `lanes[].directive` | `{ action, status }` | `action` is `continue \| pause \| stop`; `status` is 025's derived `none \| pending \| pause requested \| paused \| obeyed`. |
| `others[]` | string[] | Other unfinished run ids. |

## Not in this contract

No icon, color or layout data: those belong to the interactive view. No state is computed here: every value is read from
025/028 files through `readFleet`.

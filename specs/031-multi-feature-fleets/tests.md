---
feature: 031-multi-feature-fleets
created: 2026-11-19
---

# Tests — Multi-feature fleets

> Test design, written by `/amby.tasks` before code. One case per acceptance criterion; machine-read by `ambykit analyze`.
> Case: `- [TC-###] [US-n#k] [FR-###, FR-###] auto — short name → expected outcome`
> Name tests in code `031:FR-###: …` (qualified). All cases use fakes for the process port and the clock.

## Cases

- [TC-001] [US-1#1] [FR-001] auto — three features named → one plan lists every lane and start order, nothing started → plan shown
- [TC-002] [US-1#2] [FR-002] auto — missing or not-ready feature → stops before starting and names feature and reason
- [TC-003] [US-1#3] [FR-003] auto — same feature listed twice → scheduled once
- [TC-004] [US-1#4] [FR-001] auto — confirm starts, decline starts nothing → process port untouched on decline
- [TC-005] [US-1#5] [FR-019] auto — fleet of one feature → identical to a single run
- [TC-006] [US-2#1] [FR-004] auto — two features own the same file → serialized in dependency order then number
- [TC-007] [US-2#2] [FR-004] auto — first feature done → second starts after merging its branch into the second worktree
- [TC-008] [US-2#3] [FR-004] auto — no shared file → both run at the same time
- [TC-009] [US-2#4] [FR-005] auto — serialization in the plan → names the shared files
- [TC-010] [US-2#5] [FR-006] auto — task with no ownership → feature flagged by task id and treated conservatively
- [TC-011] [US-2#6] [FR-020, FR-022] auto — 1.x, 2.x and mixed features → same ownership and dependencies; no markdown parsing in the fleet code
- [TC-012] [US-3#1] [FR-007] auto — B depends on A (feature depends-on or story edge) → no lane of B starts before A is done
- [TC-013] [US-3#2] [FR-007] auto — dependency chain → features start in dependency order
- [TC-014] [US-3#3] [FR-008] auto — dependency not in the fleet and not done → stops and names the missing feature
- [TC-015] [US-3#4] [FR-008] auto — dependency cycle → stops and shows the cycle
- [TC-016] [US-4#1] [FR-009] auto — lane exhausts 2 restarts → its feature and all dependents pause
- [TC-017] [US-4#2] [FR-009] auto — a lane fails in feature A → independent feature C keeps running
- [TC-018] [US-4#3] [FR-009, FR-013] auto — paused feature resumed → continues and its dependents may continue
- [TC-019] [US-4#4] [FR-014] auto — paused feature → status shows cause and affected features
- [TC-020] [US-5#1] [FR-010] auto — total cap 3 with more lanes → never more than 3 run, waiting lanes start as capacity frees
- [TC-021] [US-5#2] [FR-010] auto — per-type cap (2 Claude, 1 Codex) → never exceeded
- [TC-022] [US-5#3] [FR-011] auto — token ceiling reached with a reporting runner → no new work, reported
- [TC-023] [US-5#4] [FR-011] auto — runner reports no usage and a ceiling is set → not enforced and the fleet says so
- [TC-024] [US-5#5] [FR-012] auto — no caps configured → 3 total, 2 per type for the whole fleet, overriding the per-feature cap
- [TC-025] [US-6#1] [FR-014] auto — several features running → one view shows every feature's lanes and states
- [TC-026] [US-6#2] [FR-013] auto — one feature at an approval gate → only it waits
- [TC-027] [US-6#3] [FR-013] auto — feature finishes, or hits a real merge conflict → it merges on its own and only a conflicting feature pauses
- [TC-028] [US-6#4] [FR-015] auto — pause or stop → a directive for every lane through the core writer
- [TC-029] [US-7#1] [FR-016] auto — all-ready → chosen and skipped features with reasons
- [TC-030] [US-7#2] [FR-016] auto — feature without approved spec, plan and tasks → skipped with the reason
- [TC-031] [US-7#3] [FR-016] auto — nothing ready → says so and starts nothing
- [TC-032] [US-8#1] [FR-017] auto — fleet state files → features, lanes, order, budgets and pauses readable without a model
- [TC-033] [US-8#2] [FR-017] auto — stopped fleet started again → no completed lane repeated
- [TC-034] [US-8#3] [FR-018] auto — feature changed after planning → re-plan on resume and report what changed
- [TC-035] [US-8#4] [FR-021] auto — fleet start → own fleet id and directory under .amby/fleet/ with per-feature runs named feature.n
- [TC-036] [US-8#5] [FR-021] auto — report_activity without a run → finds the feature's unfinished run inside its fleet
- [TC-037] [US-8#6] [FR-021, FR-014] auto — lanes of several features → status groups them by feature
- [TC-038] [US-9#1] [FR-019] auto — single feature → behavior, gates and merge as in a single run
- [TC-039] [US-9#2] [FR-019] auto — fleet code unused → existing command output unchanged

## Uncovered

## Flags

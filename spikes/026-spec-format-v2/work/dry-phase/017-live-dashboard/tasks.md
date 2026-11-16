---
feature: 017-live-dashboard
created: 2026-10-26
---

# Tasks — Live dashboard — worktree-aware, realtime, agent presence, full TUI polish

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Design refs: `plan.md` (architecture, mapping), `data-model.md`, signed-off `ui.md` + `design-tokens.json`.
> Story order: US-1 → US-2 (depends-on US-1) → US-3 (depends-on US-1) → US-4 (depends-on US-1, US-3).

## Phase 1 — Setup

- [x] [T001] Worktree fixture: temp repo with `.amby/`, specs on main, `ambykit`-style `.worktrees/<id>` via real `git worktree add`, helpers to tick tasks in a checkout (test/helpers/worktree-fixture.ts)
- [x] [T002] [P] Perf fixture variant: 10 worktrees / 50 features for SC-003 (test/helpers/dashboard-perf-fixture.ts)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Types: Checkout, `FeatureSnapshot.checkout`, ActivityMarker, Presence, AgentProcess, LiveState (src/core/overview-types.ts)
- [x] [T011] `readFeatures` sets `checkout: {root, kind: "main"}` by default (no output change) (src/core/features.ts)
- [x] [T012] [P] LIVE_TOKENS mirror of 017 design-tokens.json resolved against 014 tokens (src/cli/ui/dashboard/live-tokens.ts)
- [x] [T013] [P] Mirror test for LIVE_TOKENS, plus contrast table presence (test/ui/dashboard-live-tokens.test.ts)
- [x] [T014] [P] `Capabilities.icons` (ascii when !unicode, nerd via AMBYKIT_ICONS=nerd, else unicode) + tests (src/cli/ui/capabilities.ts)
- [x] [T015] [P] Optional `dashboard: {activeMinutes, idleMinutes}` in config schema + tests (src/core/config.ts)
- [x] [T016] FullscreenApp: optional `stop()` in cleanup, `resize` redraw, in-place repaint (home + EL per line + ED) (src/cli/ui/interactive/fullscreen.ts)
- [x] [T017] Tests: stop() runs on q/Ctrl-C/SIGTERM, resize redraws, no `2J` in frames (test/ui/interactive-dashboard.test.ts)
- [x] [T018] [P] AGENTS table keyed by emit-target id (family, executable matchers per C-2) + test that every TARGETS id is covered (src/core/agents.ts)

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] `resolveCheckouts(root)`: primary from `worktreeList()[0]`, feature worktrees, dirty per worktree, merged via one `branch --merged` (src/core/checkouts.ts)
- [x] [T021] [US1] Pure `mergeCheckouts(primary, worktrees)`: own-dir override/insert, ignore other copies, re-sort, displayRef collision rule (src/core/checkouts.ts)
- [x] [T022] [P] [US1] Unit tests for merge rules: override, worktree-only, ignored copies, collision (test/core/checkouts.test.ts)
- [x] [T023] [US1] `readProjectFeatures(root)` edge: resolve + read each checkout + merge; unreadable worktree → ParseIssue (src/core/checkouts.ts)
- [x] [T024] [US1] Dashboard command uses `readProjectFeatures`; `tasksForStory` and burndown take `snapshot.checkout.root` (src/cli/dashboard.ts)
- [x] [T025] [US1] `--json --overview` adds `checkout` per feature (src/cli/dashboard.ts)
- [x] [T026] [P] [US1] CheckoutTag/CheckoutBadge widget (unicode/ascii/plain) (src/cli/ui/dashboard/checkout-tag.ts)
- [x] [T027] [US1] Feature chart renders the tag column only when any feature is from a worktree (src/cli/ui/dashboard/feature-chart.ts)
- [x] [T028] [US1] WorktreesPanel (checkout columns only for now) in one-shot overview when worktrees exist (src/cli/ui/dashboard/worktrees-panel.ts)
- [x] [T029] [US1] Integration: from main and from inside a worktree show identical counts; no-worktree output byte-identical to 014 — SC-001, FR-008 (test/cli/dashboard-worktrees.test.ts)
- [x] [T030] [P] [US1] Renderer tests: tag + panel in wide/narrow/plain, NO_COLOR, ASCII (test/ui/dashboard-worktrees.test.ts)
- [x] [T031] [US1] Perf: one-shot with 10 worktrees / 50 features < 1 s — SC-003 (test/cli/dashboard-perf.test.ts)
- **Checkpoint:** US-1 is demoable — progress in `.worktrees/` visible from main.

## Phase 4 — User story US-2  (priority: P1)

- [x] [T040] [US2] `watchProject(checkouts, onChange, deps)`: recursive watch of specs/<id> + activity dirs + `.worktrees`, md/marker filter, debounce, poll fallback, `stop()` (src/cli/ui/interactive/live.ts)
- [x] [T041] [P] [US2] Tests with injected fs/timers: debounce coalesces bursts, throwing watch → polling, stop() clears all (test/ui/live.test.ts)
- [x] [T042] [US2] Pure `applyData(state, old, next)`: id-stable cursors with clamp, keep input/help, compute `changed` (src/cli/ui/interactive/overview.ts)
- [x] [T043] [P] [US2] Reducer tests for applyData: removed row clamp, filter text kept, changed keys (test/ui/interactive-overview.test.ts)
- [x] [T044] [P] [US2] LiveIndicator (watching/polling/paused, ago formatting, clock-skew → now) (src/cli/ui/dashboard/live-indicator.ts)
- [x] [T045] [US2] Header meta shows LiveIndicator in interactive mode; ChangedHighlight on changed rows (src/cli/ui/dashboard/cards.ts)
- [x] [T046] [US2] Wire interactive(): data as state, watcher → re-read → update(applyData), heartbeat, burndown cache invalidation, `r` retry, resize columns (src/cli/dashboard.ts)
- [x] [T047] [US2] Live e2e: open app on fake stdin, tick a worktree task, frame updates within 1 s; non-interactive modes create no watcher — SC-002, FR-017 (test/cli/dashboard-live.test.ts)
- **Checkpoint:** US-2 is demoable — interactive dashboard updates by itself.

## Phase 5 — User story US-3  (priority: P2)

- [x] [T050] [US3] Pure marker parse + `presenceOf(markers, tasksMtime, now, thresholds)` (src/core/activity.ts)
- [x] [T051] [P] [US3] Tests: corrupt marker ignored, future timestamp clamped, active/idle/stale, several agents → most recent + others (test/core/activity.test.ts)
- [x] [T052] [US3] `ambykit activity <feature> --agent= --phase= [--task=]` verb; writes marker + self-ignoring `.gitignore`; never fails the agent (src/cli/activity.ts)
- [x] [T053] [US3] Register the verb (src/cli/index.ts)
- [x] [T054] [P] [US3] Verb tests: round-trip per tool id, gitignore created, unknown feature warns exit 0 (test/cli/activity.test.ts)
- [x] [T055] [US3] `$AGENT` substitution in `BaseEmitter.commandFile` after transformBody (src/emitters/base-emitter.ts)
- [x] [T056] [US3] One-line self-report step in specify/design/plan/tasks/implement/converge; `--task=` on implement step 4 (src/prompts/implement.md)
- [x] [T057] [US3] Update emitter snapshot tests for each tool id; run `ambykit sync` for repo tool files (test/emitters)
- [x] [T058] [US3] Pure `matchAgents(procs, checkouts)`: C-2 matchers, `agent` only with cursor path, cwd containment, unlocated (src/core/agents.ts)
- [x] [T059] [P] [US3] Tests for matchAgents incl. self pid excluded and generic `agent` rejected (test/core/agents.test.ts)
- [x] [T060] [US3] Async process scanner per OS (CIM on Windows, ps + lsof on macOS, ps + /proc on Linux), in-flight guard (src/cli/ui/interactive/agent-scan.ts)
- [x] [T061] [P] [US3] AgentBadge + PresenceLabel (unicode/nerd/ascii, detected `~`, glyph-only narrow, generic) (src/cli/ui/dashboard/agent-badge.ts)
- [x] [T062] [US3] WorktreesPanel agent/phase/presence columns, ordering, unlocated rows, empty state; agent column in feature chart (src/cli/ui/dashboard/worktrees-panel.ts)
- [x] [T063] [US3] One-shot reads markers; interactive heartbeat runs scanner; `--icons=` flag (src/cli/dashboard.ts)
- [x] [T064] [P] [US3] Renderer tests for badges/presence in every icon mode and layout (test/ui/dashboard-agents.test.ts)
- [x] [T065] [P] [US3] "Agent detection" section with C-2/C-3 sources (docs/tool-compatibility.md)
- **Checkpoint:** US-3 is demoable — agent icons with presence on each worktree.

## Phase 6 — User story US-4  (priority: P2)

- [x] [T070] [US4] StoryDetail screen: TASKS (scroll, elision), RELATIONS (incl. reverse `blocks`), CHECKOUT & AGENT panels (src/cli/ui/dashboard/story-detail.ts)
- [x] [T071] [US4] Route detail mode to StoryDetail; remove 006 `detailView`/`listView`; add `detailScroll` (src/cli/ui/interactive/dashboard.ts)
- [x] [T072] [US4] Feature view: CHECKOUT & AGENT panel replaces clarifications slot; one-line clarifications when 0 (src/cli/ui/dashboard/feature-view.ts)
- [x] [T073] [US4] 4-panel focus cycle with Worktrees & agents; ⏎ opens feature; cursor skips unlocated rows (src/cli/ui/interactive/overview.ts)
- [x] [T074] [P] [US4] HelpOverlay per screen with glyph legend, dimmed backdrop, swallow closing key (src/cli/ui/dashboard/help-overlay.ts)
- [x] [T075] [P] [US4] FilterInput restyle in the hint row (src/cli/ui/interactive/overview.ts)
- [x] [T076] [P] [US4] EmptyState block + no-features / no-match / parse-issue summary states (src/cli/ui/dashboard/empty-state.ts)
- [x] [T077] [US4] Renderer + reducer tests for every screen in wide/narrow/plain, NO_COLOR, ASCII — SC-005 (test/ui/dashboard-screens.test.ts)
- **Checkpoint:** US-4 is demoable — every interactive screen shares the 014 design language.

## Phase 7 — Polish

- [x] [T090] [P] Dashboard docs: `--icons`, live mode, worktrees, `activity` verb (docs/cli-reference.md)
- [x] [T091] [P] Long-run test: 30-min simulated heartbeat, no leaked watchers/timers — SC-006 (test/cli/dashboard-live.test.ts)
- [x] [T092] `npm run typecheck`, `npm test`, `ambykit sync` produces no diff (package.json)
- [x] [T093] Manual hallway test on Windows: worktree + Claude/Codex session visible live (specs/017-live-dashboard/tasks.md)

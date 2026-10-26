---
feature: 017-live-dashboard
status: draft
created: 2026-10-26
---

# Implementation Plan — Live dashboard — worktree-aware, realtime, agent presence, full TUI polish

> The HOW. Satisfies every `FR-###` in `@spec.md` and the signed-off `@ui.md`; honors
> `@../../.amby/constitution.md`. Spec/UI are referenced by ID, not restated.

## Technical context

- **Stack:** Node ≥ 20, TypeScript ESM (NodeNext), Vitest.
- **New runtime dependencies:** none. Change notification uses `node:fs` `watch` (recursive) with an
  mtime-poll fallback. Process listing uses the platform tool through `node:child_process`
  `execFile` (async). No chokidar or TUI library, matching 014's dependency-free stance.
- **Constraints:**
  - **P1:** the self-report step is authored once in `src/prompts/`, and the emitter substitutes the
    tool id.
  - **P2:** the new `activity` verb is a `BaseCommand` subclass, and the substitution lives in `BaseEmitter`.
  - **P3:** the self-report step is one short line, and dashboard reads cost zero model tokens.
  - **P4:** executable names and Nerd glyphs come from sources recorded in spec C-2/C-3 and
    `docs/tool-compatibility.md`.
  - **P5:** every FR maps to a test.
  - **P7:** activity markers are project-local and self-ignoring. Process scanning is read-only and
    runs only in `--interactive`.
  - **Performance:** 014's 1 s one-shot budget (SC-003).

## Architecture

```
            ┌──────────── edges (IO) ─────────────┐        ┌──────────── pure core ────────────┐
dashboard ─▶│ resolveCheckouts(root)   git.ts     │──────▶ │ mergeCheckouts(main, wts) → snaps │
  command   │ readFeatures(checkout)   features.ts│        │ presenceOf(markers, mtimes, now)  │
            │ readMarkers(checkout)    activity.ts│──────▶ │ matchAgents(procs) agents.ts      │
            │ scanProcesses()          agent-scan │        │ computeOverview (014, unchanged)  │
            │ watchProject()           live.ts    │        └───────────────────────────────────┘
            └──────────────┬──────────────────────┘
                           ▼  update(fn) via FullscreenApp.start
              interactive reducer/renderer (pure)  ← resize, heartbeat, data events
```

- **Checkout resolution** (`src/core/checkouts.ts`, new):
  - `resolveCheckouts(root)` takes the primary checkout from `worktreeList(root)[0]` (`git.ts`) and the
    feature worktrees from `featureWorktrees` (`worktree.ts`).
  - It computes dirty state with one `git status --porcelain` per worktree, and merged state with a
    **single** `git branch --merged <default>` for all of them. This keeps one-shot under budget.
  - Not a git repo, or no worktrees: it returns `[primary]` only, which makes FR-008 hold.
- **Merge** (`mergeCheckouts`, pure, `src/core/checkouts.ts`):
  - Inputs are the primary snapshots and, per worktree, `readFeatures(wt.path)`.
  - From each worktree it keeps only the dir whose id equals `featureFromWorktreePath`. That copy
    replaces the primary's copy or is inserted, and it gets `checkout` attached.
  - The result is re-sorted with `compareFeatureDirs`, and 014's displayRef collision rule is re-run.
- **Activity** (`src/core/activity.ts` for pure parse/classify, `src/cli/activity.ts` for the verb):
  - The marker lives at `<checkout>/.amby/activity/<feature>.<agent>.json`. The directory gets a
    `.gitignore` containing `*` on first write. That keeps markers out of git (FR-019) without
    editing the user's root `.gitignore` (P7).
- **Agents** (`src/core/agents.ts`, pure): `AGENTS` maps each emit-target id to its family and its
  executable matchers. Presentation (glyph, Nerd glyph, color, name) comes from tokens. A test asserts
  that every id in `TARGETS` (`src/emitters/index.ts`) has an entry (FR-024; it also catches 016's new targets).
- **Process scan** (`src/cli/ui/interactive/agent-scan.ts`, edge, async, interactive only). Per OS:
  - **Windows:** PowerShell `Get-CimInstance Win32_Process` returns pid, name and command line. The
    cwd is not available, so matches are reported as `unlocated` (FR-023).
  - **macOS:** `ps -axo pid=,args=`. For matched pids only, `lsof -a -d cwd -p <pids> -Fn` gives the cwd.
  - **Linux:** `ps -eo pid=,args=`, with the cwd from `readlink /proc/<pid>/cwd`.
  - A cwd that falls inside a checkout attributes the agent to that checkout's feature.
- **Live** (`src/cli/ui/interactive/live.ts`):
  - `watchProject(checkouts, onChange)` watches:
    - each checkout's `specs/` (recursive; for a worktree, only `specs/<id>/`),
    - each checkout's `.amby/activity/`,
    - `<primary>/.worktrees` (non-recursive, to catch worktrees being added or removed).
  - Events are filtered to `*.md` and marker files, then debounced at
    `LIVE_TOKENS…time.debounce-ms`.
  - If `watch` throws (e.g. `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM`), the watcher switches to polling
    mtimes every `poll-s` and the mode becomes `polling` (FR-015).
  - It returns `stop()`.
  - A heartbeat timer (`heartbeat-s`) refreshes the "ago" text, presence, dirty state and the
    process scan (FR-027: no more often than every 5 s).
- **Fullscreen host** (`fullscreen.ts`):
  - Adds an optional `stop()` to `FullscreenApp`, called in `cleanup` (FR-016).
  - Listens to `output.on("resize")` and redraws with the new columns (FR-013).
  - Repaints in place: cursor home, each line followed by erase-to-end-of-line, then erase below,
    instead of `2J`. This removes the flash (ui US-2).
- **Interactive state** (`overview.ts`):
  - `OverviewTuiData` becomes a value that is replaced through `update`.
  - A pure `applyData(state, oldData, newData)`: cursors keep their **id** and clamp to the nearest
    row when the id is gone. The `input` buffer and `help` state are untouched. It computes
    `changed` keys for `component.live.changed` (FR-012).
  - Focus cycle grows to 4 panels: Attention → Up next → Worktrees & agents → Feature completion
    (FR-029).
  - New state: `help: boolean`, `live: {mode, lastChange}`, `changed: Set<string>`,
    `detailScroll: number`.
- **Rendering:** new widgets in `src/cli/ui/dashboard/`:
  - `checkout-tag.ts`, `agent-badge.ts`, `presence.ts`, `worktrees-panel.ts`, `story-detail.ts`
    (replaces the 006 `detailView`), `help-overlay.ts`, `empty-state.ts`.
  - The feature view swaps the clarifications slot for CHECKOUT & AGENT, and clarifications collapse
    to one line when there are 0.
  - All widgets support the wide/narrow/plain layouts (FR-033).
- **Tokens:** `src/cli/ui/dashboard/live-tokens.ts` mirrors `specs/017-live-dashboard/design-tokens.json`,
  resolved against the 014 tokens. It has a mirror test like `dashboard-tokens.test.ts`. 014's `TOKENS`
  is unchanged.
- **Capabilities:**
  - `Capabilities.icons: "unicode" | "nerd" | "ascii"`. It is `ascii` when `!unicode`, `nerd` when
    `AMBYKIT_ICONS=nerd`, and `unicode` otherwise.
  - `dashboard --icons=nerd|unicode|ascii` overrides it.
- **Config:** optional `dashboard: { activeMinutes?: number, idleMinutes?: number }` in the
  `config.ts` zod schema (C-1). Defaults come from the tokens' `time.active-min` and `time.idle-min`.
- **Self-report (P1):**
  - The neutral prompts specify, design, plan, tasks, implement and converge get one line:
    ``Run `ambykit activity <feature> --agent=$AGENT --phase=<phase>` (ignore errors).``
  - The implement prompt's step 4 adds `--task=T###` after each checked task.
  - `BaseEmitter.commandFile` replaces `$AGENT` with `this.toolId` after `transformBody`. Flags use
    `=`, because `parseArgs` treats `--agent claude` as a boolean flag plus a positional.

## Phased approach

- **Phase 0 — Research:** done. Spec C-2/C-3 cover the executables and Nerd glyphs. Remaining
  decisions are listed under Risks & decisions below. No `research.md` is needed.
- **Phase 1 — Foundation:** `data-model.md` (Checkout, FeatureSnapshot.checkout, ActivityMarker,
  Presence, AgentProcess, LiveState); `live-tokens.ts` with its mirror test; `Capabilities.icons`;
  the config schema; `FullscreenApp.stop`, resize handling and in-place repaint.
- **Phase 2 — US-1 (P1):** `checkouts.ts` (resolve + merge); `checkout` threaded through the
  `dashboard` command, `tasksForStory`, the burndown root and `--json --overview`; CheckoutTag in the
  feature chart; the worktrees panel in one-shot output; the parse issue for an unreadable worktree.
- **Phase 3 — US-2 (P1):** `live.ts` (watch, debounce, poll fallback, heartbeat); `applyData` reducer;
  LiveIndicator in the header; ChangedHighlight; `r` to retry when paused.
- **Phase 4 — US-3 (P2):**
  - `activity.ts` (core + verb) and the `$AGENT` substitution in prompts and `BaseEmitter`, then
    `ambykit sync` and updated snapshots.
  - `agents.ts`, `agent-scan.ts`, presence classification, AgentBadge, PresenceLabel and the
    WorktreesPanel rows.
  - `docs/tool-compatibility.md`: a new "Agent detection" section with the C-2/C-3 sources.
- **Phase 5 — US-4 (P2):** StoryDetail (with the 006 `detailView`/`listView` removed), CHECKOUT &
  AGENT panel, HelpOverlay, FilterInput, EmptyState set, and the narrow/plain variants. Docs:
  `docs/cli-reference.md` (dashboard flags, the `activity` verb).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `resolveCheckouts` runs from any checkout: the primary checkout comes from `worktreeList()[0]`, plus `featureWorktrees`. |
| FR-002, FR-004 | `mergeCheckouts` replaces or inserts the worktree's own dir. |
| FR-003 | `mergeCheckouts` keeps only the dir whose id is `featureFromWorktreePath(wt)`. |
| FR-005 | `Checkout.dirty` comes from `isDirty`; `stale` comes from a single `branch --merged` call. CheckoutTag/Badge render them. |
| FR-006 | `tasksForStory` and `readBurndown` take `snapshot.checkout.root`; git history is read in that worktree, so it follows its branch. |
| FR-007 | `overviewJson` adds `checkout: {kind, branch?, dirty?, stale?}` to each feature (additive, as in 014 FR-012). |
| FR-008 | No worktrees means `[primary]`, the tag column is not reserved and the panel is omitted. A test diffs against 014 output. |
| FR-009 | `resolveCheckouts` and `readFeatures` failures turn into a `ParseIssue` for `.worktrees/<id>`. |
| FR-010, FR-011 | `watchProject` triggers re-read, `update(applyData)` and a repaint. `.worktrees` events re-run `resolveCheckouts` and re-arm the watchers. |
| FR-012 | `applyData` handles id-stable cursors, the clamp, and keeps `input`/`help`. |
| FR-013 | The host listens to `resize`, updates the columns and repaints. |
| FR-014 | LiveIndicator in the header meta, refreshed on the heartbeat. |
| FR-015 | The `watch` error path switches to the mtime poll every `poll-s` (2 s). |
| FR-016 | `FullscreenApp.stop()` closes the watchers, clears the timers and cancels any in-flight scan, then the host restores the terminal (014 path). |
| FR-017 | Only `interactive()` constructs `watchProject` and the scanner. |
| FR-018, FR-019 | The `ambykit activity` verb writes the marker; the self-ignoring `.gitignore` sits in `.amby/activity/`. |
| FR-020 | Neutral prompt line with `$AGENT`, substituted in `BaseEmitter`. Snapshot tests check each tool's id. |
| FR-021 | `presenceOf(marker.at, tasksMtime, now, thresholds)`, with thresholds from config or token defaults. |
| FR-022, FR-023 | `matchAgents` matches executables against the C-2 table and attributes them by cwd containment; an unknown cwd lands in `unlocated`. |
| FR-024 | `AGENTS` covers every `TARGETS` id, enforced by a test. IDE ids are self-report only. |
| FR-025, FR-026 | AgentBadge with `caps.icons`; unknown ids get the generic badge. |
| FR-027 | The scan runs on the heartbeat only, uses async `execFile`, and is skipped when one is already in flight. |
| FR-028 | `story-detail.ts` (ui US-4 StoryDetail). |
| FR-029 | `worktrees-panel.ts` and the 4-panel focus cycle. |
| FR-030 | `help` state and `help-overlay.ts`; the key that closes it is swallowed. |
| FR-031 | `empty-state.ts` and the ui US-4 table. |
| FR-032 | Feature view header and the CHECKOUT & AGENT panel; agent column in the feature chart. |
| FR-033 | Every new widget gets wide/narrow/plain and NO_COLOR/ASCII tests. |
| SC-001 | Integration test with a real `git worktree add` fixture, comparing the output from main and from inside the worktree. |
| SC-002 | Live test: write a `tasks.md` and expect an `update` within 1 s. CI runs on win/mac/linux. |
| SC-003 | `dashboard-perf.test.ts` gains a variant with 10 worktrees and 50 features. |
| SC-004 | Emitter snapshots plus an `activity` round-trip test per tool id. |
| SC-005 | Renderer tests for every screen; grep test that no `interactive/dashboard.ts` 006 view remains. |
| SC-006 | A test that `stop()` closes every watcher and timer (spies on the fake fs/timers). |
| US-1…US-4 | Phases 2–5. |

## Risks & decisions

- **Recursive `fs.watch` portability.** It is supported on Windows and macOS, and on Linux from Node
  20. Mitigation: poll fallback, plus a test that injects a throwing `watch`.
- **Watch noise from worktrees** (e.g. `node_modules`). Only `specs/<id>` and `.amby/activity` are
  watched in a worktree, never the worktree root.
- **One-shot cost of git calls per worktree** (SC-003). Dirty state is one call per worktree, merged
  state is one call total, and the process scan is excluded from one-shot output.
- **Windows process cwd is unavailable.** Accepted per FR-023: those agents are shown as unlocated,
  and self-report is the primary signal.
- **Generic `agent` executable** (Cursor CLI). It matches only when the path contains `cursor`,
  avoiding false positives (C-2).
- **Process scan is slow on Windows** (PowerShell takes about 0.5 s). It runs async on the heartbeat,
  never blocks a frame, and is skipped while a scan is in flight.
- **Prompt change ripples to all consumer projects** (`ambykit update`). The line is short and its
  failure is ignored, so agents without `ambykit` on PATH are unaffected. Noted in the changelog.
- **Marker location:** it lives in the checkout where the agent works, not in the primary checkout,
  so each worktree carries its own marker and removing the worktree removes it.
- **Gap noted (no clarify needed):** spec edge case "several agents report on the same feature" →
  the most recent marker wins in rows, and the others are listed in CHECKOUT & AGENT (`also:`), as ui.md shows.
- **Related work:** 015 US-4 (lane progress) should consume `resolveCheckouts`/`mergeCheckouts`.
  Record this in 015 when it is next revised.

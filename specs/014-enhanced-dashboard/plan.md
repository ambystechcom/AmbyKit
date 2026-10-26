---
feature: 014-enhanced-dashboard
status: draft
created: 2026-10-18
---

# Implementation Plan — Enhanced dashboard — widgets and charts

> The HOW. Satisfies every `FR-###` in `@spec.md` and the signed-off `@ui.md` (binding), and honors
> `@../../.amby/constitution.md`. Spec/UI are referenced by ID, not restated.
> Supporting: `research.md` (decisions R-#), `data-model.md` (entities, invariants),
> `contracts/dashboard-json.md` (`--json` shape).

## Technical context

- **Stack:** existing — Node ≥ 20, TypeScript ESM (NodeNext), Vitest. No new runtime dependency.
- **Key libraries:** `gray-matter` (already a dependency) to read `ui.md` sign-off frontmatter;
  the `git` CLI through `src/core/git.ts` for burndown history (R-2). Charts are hand-drawn with
  terminal characters (no chart library — the medium is text, and tokens fix every glyph).
- **Constraints driving choices:**
  - Zero model tokens; every value is a local parse (Principle 3, FR-001, SC-004).
  - Read-only: no files written, no network (Principle 7, FR-017). Git is invoked read-only
    (`log`, `cat-file`) and only when the project is a git repo.
  - Reuse the 006 TUI stack — `Capabilities`, `theme.ts`, `runFullscreen`, the existing
    interactive story list/detail — and `analyzeGraph` for graph problems (Principle 2).
  - Pure core / IO at the edges: all computation in `src/core`, all ANSI/layout in `src/cli/ui`
    (AGENTS.md conventions, Principle 5 testability).
  - SC-005: existing `dashboard` tests and the current `--json` output stay byte-identical — this
    constrains FR-012 (see Risks, R-5).
  - SC-003 ≤ 1 s: parse is linear in file size; burndown bounded to two git processes (R-2).

## Architecture

```
                 ┌────────────── src/core (pure, + thin fs/git readers) ───────────────┐
specs/*/*.md ──► │ dashboard.ts   parseStories / parseTasks / computeDashboard (as-is) │
                 │ features.ts    readFeatures(root) → FeatureSnapshot[]   (fs edge)   │
                 │ overview.ts    computeOverview(snapshots, filters, opts) → Overview │
                 │                  uses analyze.ts analyzeGraph + resolveDepKey       │
git history ───► │ burndown.ts    readTaskHistory(root, scope) (git edge)              │
                 │                buildBurndown(history, now, maxPeriods) → Burndown   │
                 └──────────────────────────────┬──────────────────────────────────────┘
                                                │ plain data (no ANSI)
                 ┌──────────── src/cli/ui (pure renderers over Capabilities) ──────────┐
                 │ theme.ts            + truecolor/background caps, paintToken()       │
                 │ dashboard/tokens.ts mirror of 014 design-tokens.json (like 006)     │
                 │ dashboard/panel.ts  framed panel (normal/focused), elision          │
                 │ dashboard/*.ts      cards, status-chart, attention, up-next,        │
                 │                     feature-chart, burndown-chart, feature-view     │
                 │ dashboard/layout.ts wide | narrow | plain selection + composition   │
                 │ interactive/overview.ts  reducer+renderer; embeds existing          │
                 │                     interactive/dashboard.ts for story list/detail  │
                 └──────────────────────────────┬──────────────────────────────────────┘
                 src/cli/dashboard.ts  flags → readFeatures → computeOverview → render / JSON
```

- **`features.ts`** (new, fs edge): one pass over `specs/*/`; per feature reads `spec.md`,
  `tasks.md`, presence of `ui.md`/`plan.md`, `ui.md` `signed_off`, and clarification markers.
  A file that throws during read/parse becomes a `ParseIssue` and is skipped (FR-014).
  `computeDashboard` stays untouched so the legacy `--json` is byte-identical (SC-005).
- **`overview.ts`** (new, pure): filters (FR-011) → summary, status counts, feature rows + phase,
  attention, up next. Graph problems come from `analyzeGraph` (export `resolveDepKey` from
  `analyze.ts` instead of duplicating it — Principle 2). Attention classification is in
  `data-model.md`.
- **`burndown.ts`** (new): `readTaskHistory` runs `git log` once and `git cat-file --batch` once
  (R-2); `buildBurndown` is pure (period choice, sampling, carry-forward, working-tree last point —
  ui.md US-7 layout rules).
- **Rendering:** each widget is a pure `(caps, data, width) → string[]`; `layout.ts` picks the mode
  from `caps` per ui.md "Capability states" and stacks widgets in ui.md US-1 order. Colors resolve
  through `paintToken` (truecolor dark/light → ansi16 → none, R-3).
- **Interactive:** new `interactive/overview.ts` (pure reducer/renderer) drives the overview panels
  and feature view, and delegates the story list/detail to the existing
  `interactive/dashboard.ts` unchanged. `runFullscreen` gains an optional, backward-compatible
  `start(update)` hook so the burndown can arrive after the first frame (ui.md US-7 `computing`).

## Phased approach

- **Phase 0 — Research** → `research.md`: R-1 clarification counting, R-2 git history strategy +
  timing, R-3 truecolor/background detection, R-4 up-next cap mechanism, R-5 `--json` compatibility.
  Done in this plan; no open items block Phase 1.
- **Phase 1 — Foundation** → `data-model.md`, `contracts/dashboard-json.md`:
  1. `features.ts` + `FeatureSnapshot`/`ParseIssue`; clarification counter (R-1); phase derivation.
  2. `theme.ts` truecolor/background capability + `paintToken`; `dashboard/tokens.ts` with a test
     that it matches `specs/014-enhanced-dashboard/design-tokens.json`.
  3. `dashboard/panel.ts` (frames, focused frame, title with count, truncation, elision).
  4. Shared fixture `test/fixtures/dashboard/` (spec US-1 numbers: 3 features, 10 stories,
     25/40 tasks; plus blocked, waiting, cycle, unknown-ref, not-planned, duplicate `008-*`,
     unknown status, unassigned task, malformed file).
- **Phase 2 — P1 stories:** US-1 (summary cards, empty state, default output switch, `--stories`)
  → US-2 (status chart, feature chart, not-planned). Plain/narrow/ASCII/NO_COLOR variants built
  with each widget, not after.
- **Phase 3 — P2 stories:** US-3 (attention) → US-4 (up next, `--next`).
- **Phase 4 — P3 stories:** US-5 (feature view, phases, clarifications; interactive overview +
  `start` hook) → US-7 (burndown: history reader, builder, chart, no-history, computing) → US-6
  (`--json --overview`, last because it serializes the others).
- **Phase 5 — Docs & dogfood:** `docs/cli-reference.md` (new flags, default output change),
  CHANGELOG; run on this repo and check SC-003 timing; `npm run typecheck` + `npm test` (Principle 5).
  No `src/prompts`/`src/templates` change, so no `ambykit sync` diff (Principle 6).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `features.ts` + `overview.ts` read only `specs/*` files; `burndown.ts` reads only git objects of `specs/*/tasks.md`. No model call anywhere (SC-004). |
| FR-002 | `Overview.summary` → `dashboard/cards.ts` (ui.md US-1 SummaryCard). |
| FR-003 | `Overview.statusCounts`; fixed order and `other` bucket for unknown/empty status (data-model invariant I-2). |
| FR-004 | `status-chart.ts` (largest-remainder widths) and `feature-chart.ts` (ui.md US-2). |
| FR-005 | `FeatureRow.tasks = null` when no `tasks.md` → not-planned rendering. |
| FR-006 | Every status/attention/burndown mark comes from a `{glyph, fill, fg}` token triple; renderers never emit color without the glyph. Snapshot under `NO_COLOR` (SC-006). |
| FR-007 | `overview.ts` attention: `blocked` (status `blocked` or a not-done `blocked-by` target), `waiting` (unfinished `depends-on`); done blockers are dropped. |
| FR-008 | `analyzeGraph(...).issues` → `graph-problem` items, sorted first. |
| FR-009 | `Overview.upNext` = undone tasks of stories not in attention, feature-number then `T###` order, capped by `--next=N` (default 5, R-4). |
| FR-010 | `FeatureSnapshot.artifacts`, `phase` (ui.md US-5 PhaseLabel rule), `clarifications` (R-1). |
| FR-011 | Filters applied once in `computeOverview` (and to the burndown scope) before any aggregate; `--feature` accepts the ref (`014`) or the directory name. |
| FR-012 | `--json --overview` emits `{ stories, ...aggregates }` with `stories` identical to today's array; bare `--json` unchanged (R-5, clarified). |
| FR-013 | `readFeatures` returns `[]` → zeroed cards + hint, exit 0 (replaces today's early return). |
| FR-014 | `ParseIssue[]` from `readFeatures` → one notice line per file under the header; also in JSON. |
| FR-015 | Default one-shot → overview. Old `renderTable` kept behind `--stories` and inside the feature view; `dashboard <story-id>` path untouched. |
| FR-016 | `layout.ts` picks plain mode when `!caps.isTTY` (ui.md plain layout). |
| FR-017 | No write APIs used; git read-only; snapshot test asserts the working tree is unchanged after a run. |
| FR-018 | `readTaskHistory` + `buildBurndown` + `burndown-chart.ts` (ui.md US-7). |
| FR-019 | `Burndown.status = "no-history"` when not a repo, git missing, or < `min-points` periods. |
| SC-001 | Wide layout keeps cards, status, attention, up next in the first ~20 rows (ui.md US-1); validated by the layout check (SC-001 revised 2026-10-26). |
| SC-002 | Fixture-based value tests per widget against hand-computed totals. |
| SC-003 | Perf test: generated 30-feature / 1,000-task fixture renders < 1 s; burndown measured at ~0.3 s worst case for 1,350 blob reads (R-2). |
| SC-005 | `computeDashboard`, bare `--json`, `interactive/dashboard.ts` and their tests are untouched. |
| SC-006 | `NO_COLOR` snapshots per widget. |
| US-1 | Phase 2 · FR-002, FR-013, FR-015. |
| US-2 | Phase 2 · FR-003–FR-006. |
| US-3 | Phase 3 · FR-007, FR-008. |
| US-4 | Phase 3 · FR-009. |
| US-5 | Phase 4 · FR-010, FR-011 + interactive overview. |
| US-6 | Phase 4 · FR-012 via contract. |
| US-7 | Phase 4 · FR-018, FR-019. |

## Risks & decisions

- **FR-012 vs SC-005 conflict (R-5).** Today `--json` prints a bare array and a test asserts it is
  byte-identical to `computeDashboard`. Adding aggregates "alongside" an array is impossible without
  changing its shape. **Decision (clarified 2026-10-18, FR-012 amended):** keep `--json`
  byte-identical; aggregates via opt-in `--json --overview` (contract in `contracts/`).
- **FR-007 `blocked-by` on a done story (clarified 2026-10-18).** Done blockers are hidden; a story
  leaves Attention once all its blockers are done, unless its own status is `blocked`.
- **Clarification false positives (R-1).** Every spec contains the template's instruction text in
  backticks. Count only markers outside inline code and fenced blocks; test on this repo's own specs.
- **Duplicate feature numbers.** `StoryProgress.featureRef` is not unique (`008-*` twice). Changing
  it would alter `--json` (SC-005), so the overview computes a separate display ref (full directory
  name on collision, per ui.md US-3 notes) and keeps the model untouched.
- **Burndown cost and accuracy (R-2).** Bounded to `git log` + one `git cat-file --batch`; samples
  ≤ max-periods commits. History reflects committed state per period; the last point is the working
  tree. Shallow clones yield fewer points → may hit no-history (correct per FR-019).
- **Truecolor/background detection is heuristic (R-3, Principle 4).** `COLORTERM` and `COLORFGBG`
  are de-facto, not standards; fallback is ansi16 and dark, as the tokens specify. Flagged, not guessed.
- **Default output change (FR-015).** Users scripting the old table get the overview; mitigated by
  `--stories`, the CHANGELOG entry, and `--json` being the supported machine interface.
- **Interactive text input for `f` (feature filter).** Raw-mode line input is new to the TUI;
  kept inside the pure reducer (buffer in state), no new host IO.

## Dogfood results (T104, 2026-10-18)

Run on this repo (15 features, 65 stories, 382 tasks, 17 commits touching `tasks.md`):

- **SC-003:** `ambykit dashboard` (plain, incl. burndown) 0.06 s wall clock, 3 runs; the
  30-feature / 1,050-task perf fixture renders well under the 1 s budget (`test/cli/dashboard-perf.test.ts`).
- **SC-001 layout:** at 100 columns, completion (card row, lines 4–8), blocked count (Attention
  title) and the first Up next task (line 13–14) sit within the first 30 rows. Re-checked
  2026-10-26 after feature 017 (completion row 4, Attention row 13, next task row 14); SC-001 was
  revised to accept this layout check in place of the ≥3-user hallway test, closing T107.
- **Deviation from the plan:** Attention uses its own collision-safe dependency resolution and cycle
  detection keyed by feature directory instead of `analyzeGraph`, because `StoryProgress.key` uses
  the feature number and two `008-*` features collide; changing that key would alter `--json`
  (SC-005). `resolveDepKey` is exported (T015) but unused by the overview.

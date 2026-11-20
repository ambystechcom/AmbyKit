---
feature: 032-dashboard-redesign-and-metrics
status: draft
created: 2026-11-19
---

# Implementation Plan — Dashboard redesign and workflow metrics

> The HOW. Satisfies every `FR-###` in `@spec.md`, honors `@../../.amby/constitution.md`. Reference by ID.
> **No `ui.md` yet:** layout and tokens need `/amby.design` sign-off (person task, D1). Until then the work
> that does not depend on pixels proceeds: metrics, reducer slices, budget measurement.

## Technical context

- **Stack:** TypeScript, Node ≥ 20 (22 once 030 lands), ESM (`.js` suffixes), Vitest. No new dependency
  (ADR-004: hand-rolled renderer kept) (P3).
- **Reuse, don't reinvent (main 1.6.0):**
  - `src/cli/ui/interactive/overview.ts` — pure reducer/renderer. Today `view: overview|feature|graph|fleet`,
    `quality: boolean`, filter text `f`, `?` help. The redesign adds a **tab** layer over these, it does not
    rewrite them.
  - `src/cli/ui/interactive/fullscreen.ts` (alt-screen, restore on quit/interrupt/error — FR-005 already met;
    keep its tests), `live.ts` (watch + heartbeat), `src/cli/dashboard.ts` `interactive()` (effects in the
    `reduce` wrapper, dynamic import of heavy views so one-shot never loads them — FR-011).
  - Views to host: `dashboard/{graph-view,quality-view,fleet-view,feature-view}.ts`; tokens/icons from
    `dashboard/{tokens,fleet-tokens}.ts` and spec 029 FR-011 (`dashboard.icons`).
  - `src/core/burndown.ts` — existing history walk (`git cat-file --batch`, `parseCatFileBatch`): the metrics
    reader reuses its commit listing and batch reading.
- **Contracts consumed (not defined here, P4):**
  - **Spec 030 reader** (`src/core/spec-format/dispatch.ts`: `readSpec`, `readTasks`, `readPhases`; unmerged
    until 030 merges). Every historical revision is parsed through it (026:D-9, FR-019).
  - **Spec 031** supplies cross-feature lane grouping (`groupLanesByFeature`, name provisional) for FR-018.
  - Spec 029 `src/core/fleet-view/*` (`runView`, `fleetJson`) — the fleet tab content.
- **Constraints:** zero model tokens, local, no network (P3, P7, FR-016); one-shot and `--json` ≤ 1 s with all
  existing fields (FR-009, FR-010); tests for every FR, typecheck + test green (P5).

## Architecture

1. **Tab frame (design-gated).** `OverviewTuiState.tab: "overview"|"fleet"|"graph"|"quality"` replaces the
   scattered `view`/`quality` booleans at the surface; the existing view states become the tab bodies.
   `tabs.ts` is a pure reducer slice (`nextTab`, `prevTab`, number keys `1-4`, `tab`/`shift-tab`) and a
   `renderTabBar` using the signed-off tokens. Empty tabs use `empty-state.ts` (FR-002).
2. **Search/filter slice** (not design-gated; text only). Generalise today's feature filter into
   `listFilter.ts`: `{query, state}` applied to features, stories and lanes (`/` search, `s` cycles the state
   filter, `esc` clears). Pure; the active filter is a returned string the renderer shows (FR-006).
3. **Metrics** `src/core/metrics/*` (pure + one git edge):
   `readRevisions` (edge: commit list per artifact via `git log --follow`-free path walk + `cat-file --batch`),
   `phaseCycle(revisions)` (first commit touching an artifact → first commit where `isComplete`), `gapRate`
   (gap tasks appended per converge commit ÷ requirement count), `typical` (median across features). Each
   revision goes through `readSpec/readTasks`; an unreadable revision is skipped and counted (FR-019). Fewer
   than 3 features with a complete phase, or 0 converge runs → `{enough:false}` (FR-008). Loaded async in the
   interactive dashboard only (US-4 last AC, FR-011); `dashboard --json --metrics` (opt-in, additive field
   `metrics`) exposes it for scripts.
4. **Fleet tab** hosts 029's view; adds feature grouping via 031's grouping (gated on 031).
5. **Budget guard** `test/cli/dashboard-budget.test.ts` measures one-shot + `--json` on the largest fixture
   with the 030 reader in place (FR-009, FR-020); metrics and graph stay out of one-shot (FR-011).

## Phased approach

- **Phase 0 — Spike/gates:** inventory the hosted views and confirm which states the one-shot path loads;
  record the 030 and 031 contracts used (`research.md` only if they differ from the names above).
- **Phase 1 — Foundation:** metrics model + `data-model` below, list filter slice, tab reducer slice (no
  rendering), budget test harness. All proceed before design sign-off.
- **Phase 2 — US-4 metrics** (P1): reader, calculations, JSON, async interactive loading (030-gated for v2).
- **Phase 3 — US-2/US-3 keyboard, search, filter** (P1/P2): wiring of the slices into `reduceOverviewTui`,
  key list in the `?` overlay.
- **Phase 4 — Person gate:** `/amby.design` for the tab frame, tab bar, metrics panel and tokens; sign-off
  recorded (`signed_off` in `design-tokens.json`). **Gates Phases 5–7.**
- **Phase 5 — US-1/US-7 tab frame + look** (gated by Phase 4): render tab bar and bodies, empty states,
  consistent state rendering.
- **Phase 6 — US-6 terminals, US-5 stability** (gated): narrow/no-color/no-icon/resize/piped on every tab.
- **Phase 7 — Fleet tab grouping** (gated by Phase 4 and 031): feature grouping across features.
- **Phase 8 — Integration:** docs (`docs/cli-reference.md`, site dashboard page), changelog, goldens, sync
  twice, full checks, dogfood tour of all tabs (SC-001, SC-007).

## Data model (metrics)

`Revision {commit, time, text}`; `PhaseCycle {feature, phase: spec|plan|tasks|converge, startedAt,
completedAt|null, ms|null}`; `GapPoint {feature, commit, time, gapTasks, requirements, rate}`;
`Metrics {phases: {phase, perFeature[], typicalMs}[], gap: GapPoint[], skipped: number, enough: boolean}`.
Completed state: spec `status: ready|done`; tasks all checked (via `readTasks`); converge = a commit whose diff
appends tasks marked as gap tasks. Rewritten history (squash/rebase) yields fewer points, never an error.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, US-1 | tab state + bar over existing views (Phase 5) |
| FR-002 | `empty-state.ts` per tab (Phase 5) |
| FR-003 | tab bodies reuse the existing panels unchanged; a snapshot parity test per panel |
| FR-004, US-2 | `tabs.ts` + key map, `?` lists keys (Phase 3) |
| FR-005 | existing `fullscreen.ts` restore; tests re-run on the tabbed app |
| FR-006, US-3 | `listFilter.ts` (Phase 1/3) |
| FR-007, FR-008, US-4 | `src/core/metrics/*` (Phase 2) |
| FR-009, FR-010, FR-020, US-5 | budget test + `--json` field-set test (Phase 1, 6) |
| FR-011 | dynamic import of metrics/graph; one-shot import-graph test |
| FR-012, FR-013, FR-014, US-6 | tokens + icon modes, resize, piped fallback (Phase 6) |
| FR-015, FR-016, US-7 | signed-off design (Phase 4); no network/model: grep-style guard test |
| FR-017 | existing non-interactive commands untouched; output-parity tests |
| FR-018 | fleet tab + 031 grouping (Phase 7) |
| FR-019 | revisions via 030 `readSpec/readTasks`; skip-and-count test with a mixed v1/v2 history |

## Risks & decisions

- **D1 — Design is a person gate** (like 029 T022): no tab rendering before sign-off; reducers are pure so
  they are testable now.
- **D2 — Tab layer over existing views**, not a rewrite, to keep FR-003 (no loss) and the current tests.
- **D3 — Metrics are opt-in on `--json`** (`--metrics`), never in the default payload (FR-010, FR-011).
- **R1 — 030 and 031 are unmerged:** v2-history metrics and feature grouping are gated tasks; v1 metrics can
  be built on the shipped parsers behind the same interface.
- **R2 — Converge detection** from commit diffs is a heuristic (gap-task marker); measure on this repo's own
  history and say "not enough data" rather than guess.
- **R3 — Large history:** metrics read is async and capped (default last 500 commits per artifact set);
  record the cap in `contracts` if a flag is added. Suggest `/amby.clarify` if the cap should be visible.
- **R4 — Spec gap:** FR-012's "narrow" width threshold is unspecified; plan uses the existing compact layout
  breakpoint from 029 and flags it for the design phase.

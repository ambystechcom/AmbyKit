---
feature: 020-blocked-and-verify
status: draft
created: 2026-11-16
---

# Implementation Plan — Blocked markers and Verify lines

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> No `ui.md`: no new screens. The dashboard gains a few text lines inside existing panels.

## Technical context

- **Stack:** TypeScript ESM/NodeNext, Node ≥ 20, Vitest. No new dependencies.
- **Key modules (all exist today):** `parseTasks` and `TaskLine` in `src/core/dashboard.ts`;
  `analyzeProject` in `src/core/analyze.ts` and `src/cli/analyze.ts`; `readFeatures` in
  `src/core/features.ts`; `attentionItems`, `upNext`, `featureRow` in `src/core/overview.ts`; types in
  `src/core/overview-types.ts`; panels in `src/cli/ui/dashboard/` (`attention.ts`, `feature-chart.ts`,
  `feature-view.ts`, `story-detail.ts`, `tokens.ts`).
- **Constraints driving choices:**
  - P1: the prompts, template and docs change in `src/prompts/`, `src/templates/`; generated files come
    from `ambykit sync`, never by hand.
  - P2/AGENTS: one new pure module (`src/core/markers.ts`); `BaseCommand` subclasses keep only the
    printing; no parser logic in `cli/`.
  - P3: parsing and reporting are local, no model tokens; the prompt additions are a few lines each
    (the `implement` and `tasks` prompts grow by well under 150 words together).
  - P5: a test per FR, plus a baseline test for SC-002; `npm run typecheck` and `npm test` pass.
  - P6: 020 is built with its own parallel lanes (SC-005); `ambykit sync` leaves no diff.
  - Additive only (US-5): optional fields, no renamed or removed JSON keys, and no output change for
    projects that use neither marker.

## Architecture

```
tasks.md ──► parseTasks (dashboard.ts) ──► TaskLine {…, blocked?, deviation?}   ◄── markers.parseMarkers
        └──► parsePhases (markers.ts)  ──► PhaseVerify[] {phase, check, result, why}
                       │                                  │
         features.ts: FeatureSnapshot {tasks, verify}     │
            ┌──────────┴────────────┐                     │
   core/analyze.ts (report)    core/overview.ts (attention, upNext, FeatureRow)
   cli/analyze.ts (text/json)  cli/ui/dashboard/* (text in existing panels), --json --overview
```

- **Marker syntax (FR-001/002/003):** markers are the *trailing* segment of a task line, after the
  path group: `… (src/a.ts) ⚠ BLOCKED: waiting on the API key ↪ DEVIATION: used a stub`. The glyphs are
  optional (`BLOCKED:` / `DEVIATION:` work alone). `parseMarkers(rest)` cuts the line at the first
  marker keyword, parses each marker's text up to the next keyword or end of line, and returns the
  remaining body, so a reason containing `(…)` or backticks can never be read as file ownership and the
  existing `parseDeclaredPaths(body)` runs on exactly what it sees today.
- **Phases and Verify (FR-005..008):** `parsePhases(content)` walks `## ` headings with the *same*
  numbering rule as `parseTasks` (extracted into one shared `phaseNumber` helper, so both agree), and
  in each phase reads `**Verify:** <check> [✓ passed | ✗ failed: <why> | ? unverified]`, with an
  optional leading `- `. A phase is "verifiable" when it holds at least one task.
- **Reporting:** `analyzeProject` adds `blockedTasks`, `deviations`, `markerIssues` and `verify`
  findings to `AnalysisReport` (new keys only). `computeOverview` adds two attention kinds
  (`task-blocked`, `verify-failed`), excludes blocked tasks from *Up next*, and gives `FeatureRow`
  optional `blocked` and `verify`. All are omitted when empty, so existing output is unchanged.
- **Plain-text rule (FR-014):** every new line states the word (`BLOCKED`, `verify failed`) and the ID;
  glyphs come only from the existing icon tokens with their ASCII fallbacks.
- **Exit status:** blocked tasks and every Verify finding are warnings; `analyze` still exits non-zero
  only for cycles, dangling references and lane conflicts (US-4 AC4).
- **Cost:** one extra regex pass per task line and one per heading, inside the existing read of
  `tasks.md`; no extra file reads, so the 1-second one-shot budget (SC-001) is kept.

## Phased approach

- **Phase 0 — Research (Setup):** record the baseline parse of every existing `specs/*/tasks.md`
  (task id, done, story, phase, parallel, paths) *before* touching the parser → fixture for SC-002.
- **Phase 1 — Foundation:** `src/core/markers.ts`, `TaskLine`/`parseTasks` integration,
  `FeatureSnapshot.verify` and the new attention kinds in the types, `features.ts` populating `verify`.
- **Phase 2+ — Stories, in dependency order:** US-1 (markers, prompt and template text) → US-2 (blocked
  surfaced) ∥ US-3 (Verify convention) → US-4 (Verify surfaced) → US-5 (regression, docs, goldens, sync).
  In each story phase the independent file edits are `[P]` lanes; tests that need the merged code run after.
- **Build order and integration:** 020 builds first (1.4, single lane). T064 (golden re-record) and T065
  (`ambykit sync`) are integration steps run once per batch after merging, never inside a lane branch. 023
  builds after 020 and records its goldens from the 020 tip, because both edit `attentionItems`.
- **Shared hotspot files:** rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts,
  src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-002, FR-003, FR-004 | `parseMarkers` and the `TaskLine.blocked/deviation` fields; empty reason → `blocked` with `markerIssues` entry; checked + blocked → inconsistency entry, not counted as blocked |
| FR-005 | `parsePhases` finds one `**Verify:**` per phase; extra lines in a phase are reported as an issue, the first is used |
| FR-006, FR-007, FR-008 | `implement` prompt: run the check before the checkpoint, rewrite the result suffix in place, never pass a checkpoint on `✗ failed`, ask a person for a check it cannot run and write `? unverified` |
| FR-009 | `analyzeProject` + `cli/analyze.ts` (blocked tasks with reasons, phases without Verify, last Verify failed) |
| FR-010 | `computeOverview` attention and `FeatureRow` fields; feature view and story detail text; `--json --overview` rows |
| FR-011, FR-012, SC-002 | baseline fixture test over all repo `tasks.md`; unchanged-output test when no markers exist |
| FR-013 | additive optional keys only; documented in `docs/cli-reference.md` |
| FR-014 | text-first lines; existing icon tokens with ASCII fallback; test with `--icons=ascii` and plain layout |
| FR-015 | `src/templates/tasks.md`, `src/prompts/tasks.md`, `src/prompts/implement.md`, `docs/artifacts/tasks.md` |
| FR-016 | `implement` prompt: on a block, add the marker, stop that task, continue with another unblocked task |
| US-1 … US-5 | phases 3–7 of `tasks.md` |

## Risks & decisions

- **R1 — check-off merge:** `mergeCheckoffs` (`src/core/lanes.ts`) aborts when two sides differ in more
  than the checkbox. Two lanes adding markers on *different* lines merge cleanly in git itself; a marker
  and a tick on the *same* line still abort, as any non-check-off change does today. Kept as is (no new
  merge rule); covered by a test that documents it (SC-005).
- **R2 — spec v2:** spec 030 moves per-task data into fenced blocks. Markers and Verify lines must be
  representable there; the spike (026) and 030 must carry these two conventions. Note for those specs.
- **R3 — MCP tick tool (spec 025):** the validated "tick a task" path must preserve markers and the
  Verify result suffix when it rewrites a line. Note for 025.

## Open decisions (defaults chosen; none needs a clarify before building)

1. **Marker placement:** trailing, after the path group; text before the first marker is the body. Default taken.
2. **Several BLOCKED markers on one line:** one blocked task, reasons joined with ` | `.
3. **Missing-Verify warnings** go to features that are not fully done (finished features cannot act on
   them), grouped as one line per feature in text output, listed per phase in `--json`. The spec says
   "phases without a Verify line" without this scope.
4. **Glyph-less result words** (`passed`, `failed: …`, `unverified`) are accepted next to `✓ ✗ ?`, for
   consistency with the ASCII rule for `BLOCKED:`; the spec lists only the glyph forms.
5. **One result per Verify line:** a later run overwrites the suffix; history lives in git, so an earlier
   failure is never "current" (US-3 AC3).
6. **Phase identity** in findings is `<feature>:phase-N` (the `## Phase N` number), since phases have no
   stable ID; FR-009 says "by stable ID".
7. **Up next / lanes:** blocked tasks are excluded from *Up next*; lane planning is unchanged.
8. **JSON:** `analyze --json` gains `blockedTasks`, `deviations`, `markerIssues`, `verify`; overview
   rows gain optional `blocked` and `verify`; bare `dashboard --json` (stories) is unchanged.

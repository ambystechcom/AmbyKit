---
feature: 021-test-design
status: draft
created: 2026-11-16
---

# Implementation Plan — Test design before code

> The HOW. Satisfies every `FR-###` in `@spec.md`; honors `@../../.amby/constitution.md`. No UI, so no
> `ui.md`. Spec/IDs are referenced, not restated.

## Technical context

- **Stack:** the existing TypeScript/Node ESM CLI (`src/core` pure functions, `src/cli` edges), neutral
  prompts in `src/prompts/`, neutral templates in `src/templates/`, Vitest. No new dependency (Principle 3).
- **Key libraries:** none new; reuse `gray-matter` only if the new parser needs frontmatter (it does not).
- **Constraints driving choices:** author once, emit per tool — prompts and the new template are edited
  in `src/`, then `ambykit sync` regenerates tool files (Principle 1); the added prompt text stays small
  and `tests.md` is loaded only by the phases that need it (Principle 3); `analyze` stays local at zero
  model tokens; every FR gets a test and typecheck/tests pass before commit (Principle 5); built with its
  own `tests.md` (Principle 6); additive only, no format change to existing specs (US-7).

## Architecture

Four pieces, each small:

1. **Template `src/templates/tests.md`** — the `tests.md` format (below). Installed to
   `.amby/templates/tests.md` by adding it to `ARTIFACT_TEMPLATES` (write-if-absent, so existing
   projects pick it up on `sync`).
2. **Prompt edits (neutral source).** `/amby.tasks` also writes `tests.md` in the same phase (FR-010,
   no new command, FR-012). Smaller edits: `/amby.implement` (QA note when absent, build to the cases,
   qualified test names), `/amby.converge` (read cases as expected tests), `/amby.revise` (flag stale
   cases). Rules the model must follow stay short; the format lives in the template, not the prompt.
3. **Pure checker `src/core/test-design.ts`.** `parseTestDesign(text)` and
   `checkTestDesign(specText, design)` return findings: unknown IDs (FR-008), uncovered FRs not marked
   deliberately uncovered (FR-007), bad decisions (FR-004/FR-006), more than 15 cases for a story (US-1),
   duplicate case IDs (FR-009). No fs; spec IDs are extracted with a tiny local parser (FR and story
   IDs plus the number of acceptance bullets per story).
4. **`analyze` integration.** `analyzeProject` reads `specs/*/tests.md` next to each feature and adds
   `testDesign: { findings, missing }` to `AnalysisReport` (additive JSON field). Human output prints
   findings only for features that **have** a `tests.md`; features without one appear only under
   `missing` in `--json`, so existing output is byte-identical (FR-015, SC-004). Findings never change
   the exit code (non-blocking).

```
/amby.tasks ──► tasks.md + tests.md  ──► /amby.implement (QA note, build to cases)
                     │                └─► /amby.converge (cases = expected tests)
                     └─► ambykit analyze (src/core/test-design.ts, zero tokens)
```

## Data model — `tests.md`

Machine-readable lines; prose stays out. Criterion reference `US-n#k` = the k-th acceptance bullet of
story n (derived, spec gets no new IDs).

```
---
feature: NNN-slug
---
## Cases
- [TC-001] [US-1#2] [FR-001, FR-003] auto — short name → expected outcome
- [TC-002] [US-3#1] [FR-007] manual:visual-check — short name → expected; verify: how; record: where
## Uncovered
- FR-009: deliberately uncovered — reason
uncovered: FR-010 — reason
## Flags
- US-2#3: too vague to test — reason
```

- **Shared grammar (021 owns this format; spec 024's `trace` adopts it, Q-06):** a deliberately
  uncovered requirement is written either as the section line `- FR-###: deliberately uncovered —
  reason` or as the one-line form `uncovered: FR-### — <reason>` (bullet optional). `parseTestDesign`
  accepts both and returns them identically; `checkTestDesign` and spec 024's reader MUST go through
  this one parser (exported from `src/core/index.ts`), never a second grammar. Criterion references
  are the positional `US-n#k` below; 024 cites them as-is.
- Skip form: the whole file is one line `skipped: <reason>` (FR-016).
- Case IDs `TC-###` are allocated as max+1 and never reused; a case whose criterion was removed is kept
  and suffixed `[obsolete]` (FR-009, FR-013). A stale case is suffixed `[stale]`.
- Manual reasons come from a fixed list: `human-judgment`, `external-system`, `visual-check`, `one-off`
  (FR-006). Default is `auto`.

## Phased approach

- **Phase 0 — Research:** none needed beyond reading `src/core/dashboard.ts` task parsing and
  `src/core/analyze.ts`; no `research.md`.
- **Phase 1 — Foundation:** template + scaffold entry + the pure parser/checker with unit tests.
- **Phase 2+ — Features:** US-1/2/3 (prompt + checks, P1), US-7 (adopt/skip, P1), then US-4/5/6 (P2)
  as small prompt edits, then docs, regenerated tool files and golden re-record.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-002, FR-003 | `/amby.tasks` prompt step: only for a `ready` spec; one case per criterion; vague criteria go to `## Flags`. |
| FR-004, FR-005, FR-006 | Case line format and fixed manual reasons in the template; checker validates decision, reason and manual `verify:`/`record:`. |
| FR-007, FR-008, FR-009 | `checkTestDesign` (uncovered FRs, unknown IDs, duplicate IDs); IDs max+1, never reused. |
| FR-010, FR-012 | `tasks` prompt `writes:` gains `tests.md`; one file per feature, no new command. |
| FR-011 | `/amby.implement` checkpoint step notes a missing `tests.md` (QA phase of spec 019 reuses it). |
| FR-013 | `/amby.revise` flags `[stale]`/`[obsolete]`; re-running `/amby.tasks` patches only flagged cases. |
| FR-014 | `/amby.converge` reads the trace matrix first when spec 024 exists, then `tests.md`. |
| FR-015 | `analyze` output unchanged for features without `tests.md` (JSON `missing` only). |
| FR-016 | `/amby.tasks` accepts a skip argument and writes `skipped: <reason>`; checker treats it as valid. |
| FR-017 | Prompts/template authored in `src/`, emitted by `sync`; format kept in the template, loaded on demand. |
| US-1 … US-7 | Phases below; one phase per story group, checkpoint after each. |

## Risks & decisions

- Acceptance bullets have no IDs, so `US-n#k` is positional: reordering criteria shifts the numbers and
  surfaces as `[stale]` flags rather than silent drift. Accepted trade-off; see Open decisions.
- Prompt growth vs Principle 3: capped at about a dozen added lines across `tasks`; golden snapshot
  diffs make growth visible in review.
- Golden fixtures for the emitters change because three prompts change; re-record is a deliberate,
  reviewed step (T-polish), never mixed with logic changes.
- Spec 024 (`trace`) and spec 019 (`/amby.run`) are not built yet: converge wording is conditional
  ("where a trace matrix exists") and QA behavior lives in the implement checkpoint for now.
- **Build lane (Q-13):** 021 and 022 both edit `src/core/scaffold.ts` (`ARTIFACT_TEMPLATES`),
  `test/scaffold.test.ts` count assertions and `src/core/rules.ts`, so they build in ONE lane: 021
  first, then 022, and 022 rebases its template counts on 021's.
- **Shell-grant dependency (Q-07):** the prompts here call `ambykit` verbs; they depend on spec 024's
  T031 (generalized Claude shell grant, batch 0 foundation) being built first. If 021 builds first, it
  adds no verb call beyond what `ambykit activity` already grants.
- **Integration steps (Q-11):** golden-fixture re-record and `ambykit sync` (T094/T095) are not run in
  the lane branch: they run once per integration batch after the lanes merge, then their result is
  reviewed as one diff.

## Open decisions

- **Criterion addressing:** positional `US-n#k` (default) vs adding explicit AC IDs to the spec template
  (would touch the spec format; belongs to spec v2). Still open: whether `US-n#k` belongs in the spec
  or spec v2; spec 024 uses `US-n#k` meanwhile.
- **No-design visibility:** features without `tests.md` appear only in `analyze --json` `missing`
  (default); alternative is a human-output note, rejected to keep output unchanged.
- **Refresh trigger:** `/amby.revise` marks `[stale]`, `/amby.tasks` re-run resolves (default); a
  dedicated command was rejected (FR-012).
- **Format placement:** rules live in the template, not a `.amby/reference/` doc (default; cheaper to
  load); revisit if the template grows past ~40 lines.
- **Case limit enforcement:** 15 per story is a finding, not an error (non-blocking, default).

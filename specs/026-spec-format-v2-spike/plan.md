---
feature: 026-spec-format-v2-spike
status: draft
created: 2026-11-16
---

# Implementation Plan — Spec format v2 spike

> The HOW of a 5-working-day spike. The deliverable is a **decision document plus prototype findings**
> (FR-011), not shipped code (FR-012, FR-014). References `@spec.md` by ID; honors
> `@../../.amby/constitution.md`. No UI, so no `ui.md`.

## Technical context

- **Stack:** the repo's own: Node ≥ 20, ESM, TypeScript. Prototypes are **plain `.mjs` scripts**, run with
  `node`, importing the already-built `dist/core/*.js` (so "what dashboard/analyze use today" is the real
  code, FR-003). They are not typechecked and not packaged.
- **Key libraries:** none new (spec Assumptions; FR-014). `gray-matter` is already a runtime dependency
  (`src/core/features.ts` reads `ui.md` frontmatter with it) and already bundles a YAML engine
  (`matter.engines.yaml`), so frontmatter **and** fenced YAML blocks are parsed with it. Token cost is
  measured with a documented approximation (characters ÷ 4, plus word count), because no tokenizer is a
  dependency.
- **Constraints driving choices:** Principle 3 (token frugality: v2 must not cost more to read than 1.x);
  Principle 4 (formats verified, not guessed: the v1 model comes from the shipped parsers, not from a
  reimplementation); Principle 5 (each FR gets a verification step); Principle 6 (the spike is specced,
  planned and tasked with AmbyKit and its tasks use 020's conventions).
- **Where things live:** all prototype code and data under `spikes/026-spec-format-v2/` at the repo root.
  It is outside `src/` (tsc `include`), outside `package.json` `files` (not packed) and outside `test/`.
  The decision document is the only artifact under `specs/`.

## What the spike tests (spec FR-002, not reopened)

Hypothesis **H1** (the decided split): v2 `spec.md` carries feature and story metadata in YAML
frontmatter (`feature`, `status`, optional feature-level `depends-on`, and a `stories:` list with `id`,
`title`, `priority`, `status`, `depends-on`, `blocked-by`); the prose headings stay (`### US-1 — …`) and
the per-story metadata bullets are dropped. v2 `tasks.md` keeps the human checkbox lines
(`- [ ] [T###] [P] [US#] description`, so check-off and the check-off-aware merge are untouched) and moves
the trailing `(file/path)` ownership and the phase `**Verify:**` data into **fenced `yaml` blocks**.

Open shape, answered by measurement rather than opinion: block layout **L-phase** (one fenced block per
phase mapping `T###` to `files:` plus the phase `verify:`) versus **L-task** (one small block under each
task line). Compared on token cost, readability, and merge behaviour when two lanes edit the same file.

## Architecture (prototype components)

```
spikes/026-spec-format-v2/
  baseline.mjs     v1 model for every spec via dist/core/dashboard.js (parseStories/parseTasks) → model-v1.json
  model.mjs        the one comparable model: feature meta, stories, tasks (id, done, story, phase, parallel,
                   paths, verify), plus `formatsUsed` per file
  read-v2.mjs      v2 reader: gray-matter frontmatter + yaml engine for fenced blocks; errors carry file:line
  read.mjs         dispatcher: detects v1/v2 per file (not per feature), reports mixed features
  migrate.mjs      v1 → v2, `--dry-run`, diff summary, idempotent, skip-and-list unsafe specs
  compare.mjs      model equality + difference listing (SC-001)
  measure.mjs      token/word counts per file and format, L-phase vs L-task
  lanes-merge.sh   two-branch edit experiment on a temp git repo (merge cleanliness per layout)
  work/            temp COPY of specs/ that migrate writes to (git-ignored by not being committed)
```

Boundaries: `read*`/`compare`/`measure` are pure functions of file text; only `migrate.mjs` and the
lane experiment write files, and only inside `work/` or an OS temp dir. The real `specs/` tree is never
modified by the spike (FR-012, SC-005); "in place" is proven on a copy.

## Phased approach

- **Phase 0 — Research (day 1):** inventory every reader of today's markers (`parseStories`,
  `parseTasks`, `parseDeclaredPaths` in `src/core/dashboard.ts`; their callers in `features.ts`,
  `analyze.ts`, `overview.ts`, `lanes.ts`, `burndown.ts`, `checkouts.ts`) and the edge cases from the spec
  (cross-feature `NNN:US-#`, `[NEEDS CLARIFICATION]`, CRLF, unusual path characters); fix the comparable
  model; snapshot the v1 baseline over all 20 specs.
- **Phase 1 — Foundation (day 1–2):** scratch directory, `model.mjs`, `baseline.mjs`; confirm
  `npm run build` output is importable from `.mjs`.
- **US-1 reader (day 2):** `read-v2.mjs`, `read.mjs`, `compare.mjs`; hand-written v2 fixtures for edge
  cases; malformed and mixed-format reports with locations (FR-004).
- **US-2 migrate (day 3):** `migrate.mjs` on a temp copy; dry-run, idempotence, skip list, prose
  byte-preservation check; run the **current** 1.x reader on converted output and record the result
  (FR-010).
- **US-3 measure (day 4):** token and readability comparison on at least three specs (SC-003); lane-merge
  experiment for L-phase vs L-task; can an assistant load less in v2 (US-3 AC3).
- **US-4 decision (day 5):** `decision.md` with decision IDs `D-1…`, findings, risks, what 027 and 030
  may assume; if the box is exceeded, the partial write-up and the extension question (FR-013).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-011 | `specs/026-…/decision.md`, written last, states the v2 carrier, risks, and assumptions for 027/030 |
| FR-002 | H1 above is what `read-v2.mjs` and `migrate.mjs` implement; L-phase vs L-task are the only open variables |
| FR-003, US-1 | `read.mjs` yields one model from both formats; `compare.mjs` diffs it against `baseline.mjs` output built from the shipped parsers |
| FR-004 | v2 reader errors carry `file:line`; unknown format is reported, never defaulted |
| FR-005, FR-006, FR-007, US-2 | `migrate.mjs`: dry-run prints a diff summary and writes nothing; second run produces a byte-identical tree; unsafe specs are untouched and listed |
| FR-008 | the run in Phase US-2 and the comparison in US-1 use `specs/` (copied) as the sample |
| FR-009, US-3 | `measure.mjs` output table plus a short readability note in the decision |
| FR-010 | current `parseStories`/`parseTasks` run on converted copies; outcome stated per field |
| FR-012, FR-014, SC-005 | prototypes confined to `spikes/` (not in `src/`, `files`, or the typecheck); no command output changes (the existing suite still passes, T-final) |
| FR-013 | day-5 gate task: if unfinished, write partials and stop |
| SC-001 | `compare.mjs` over all 20 specs: identical or every difference listed |
| SC-002 | migrate over the copy twice; diff of run 1 vs run 2 is empty; prose diff is empty |
| SC-003, SC-004, SC-006 | measure table with ≥ 3 specs; decision usable by 027/030; every FR above has a Verify line in `tasks.md` |

## Risks & decisions

- **Risk: reimplementing the v1 parser.** Mitigated by importing the built `dist/core/dashboard.js`; the
  baseline is the product's own behavior (Principle 4).
- **Risk: story metadata duplicated in frontmatter and prose drifts.** The spike migrates by *moving*
  metadata (prose bullets dropped) and records, as a finding, whether a transition period needs
  dual-write for the current reader.
- **Risk: 020 (BLOCKED, deviation notes, Verify lines) lands in 1.4 before v2.** v1 parsing of those
  markers is not shipped yet; the model keeps them as text on the task line and the phase `verify`, and
  the decision states how v2 carries them.
- **Risk: timebox.** Hard stop at the end of day 5; partial findings are still a valid deliverable
  (FR-013).
- **Decision:** prototypes are `.mjs` against `dist/`, because it needs no build config, no new
  dependency, and cannot leak into the package. Rationale: FR-012, FR-014.

## Open decisions (default chosen; no one was asked)

1. **Scratch location:** `spikes/026-spec-format-v2/` at repo root. Default taken; alternative is
   `.amby/scratch/`. Harmless either way since neither is packed.
2. **Token measurement:** characters ÷ 4 and word count, no tokenizer dependency. Alternative: add a
   dev-only tokenizer; rejected unless the spike's numbers look close to a tie.
3. **Requirement IDs in structured data:** the roadmap lists them; spec 026 FR-002 does not. Default:
   `FR-###` stays in prose in the spike, and the decision flags whether `trace` (024) needs them
   machine-listed.
4. **Migration is a move, not a copy:** prose metadata bullets are removed after frontmatter is written.
   Default; the dual-write alternative is evaluated as a finding.
5. **Plans and `ui.md`:** not migrated (consistent with 030's decision that plans are out of 2.0).
6. **Owner:** "named at kickoff" per the spec; tasks carry no owner.

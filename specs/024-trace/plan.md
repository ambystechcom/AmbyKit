---
feature: 024-trace
status: draft
created: 2026-11-16
---

# Implementation Plan — Requirement traceability (trace)

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> Spec/UI referenced by ID, not restated. No `ui.md`: the spec adds a coverage figure and one
> interactive view to the existing dashboard, no new screen design.

## Technical context

- **Stack:** TypeScript, Node ≥ 20, ESM (`.js` import suffixes), Vitest. No new runtime dependency (the
  006 cap holds): file discovery is a small `readdirSync` walk, test titles come from a text scan.
- **Key libraries:** existing `zod` (config schema), existing `gray-matter` untouched.
- **Constraints driving choices:**
  - Zero model tokens, local only (Principle 3) → pure core + thin fs edge.
  - One-second dashboard budget (SC-001, FR-012) → scan once per run, cap what is read, measure in a perf test.
  - Pure functions in `src/core`, fs/process at the edges (AGENTS.md conventions; mirrors `features.ts`).
  - New verb = `BaseCommand` subclass, never copied orchestration (Principle 2).
  - Converge text lives only in `src/prompts/converge.md`; tool files are generated (Principles 1, 6).
  - Strictly additive (US-7, FR-019): optional fields only, no existing output changes without data.

## Architecture

```
specs/NNN-*/spec.md ──► trace-requirements ─┐
                        (FR ids + text +    │
                         "uncovered:" notes)├─► buildMatrix(features, tests) ─► TraceReport
test files ──► trace-io (walk, read) ──►    │      (pure, trace.ts)
   trace-tests (titles, skip status)        │
   trace-cite  (qualified-id prefix) ───────┘
tests.md (spec 021) ──► trace-design (US-6) ─┘

consumers: cli/trace.ts (text, --json, --gate) · dashboard coverage figure + quality view ·
           /amby.converge (runs `ambykit trace --json`) 
```

- **Pure core** (`src/core/`): `trace-types.ts` (report shape), `trace-requirements.ts` (parse
  `FR-###` lines + `uncovered:` notes), `trace-cite.ts` (parse a test title's citation prefix),
  `trace-tests.ts` (extract `it`/`test` titles and skip state from source text), `trace.ts`
  (`buildMatrix`: requirements × tests → covered / uncovered / deliberate / skipped-only / orphan /
  uncited / ambiguous, plus coverage counts), `trace-design.ts` (US-6, read designed cases).
- **fs edge:** `trace-io.ts` walks the configured roots, reads test files and each feature's
  `tests.md`; the only module that touches the disk. `features.ts` already reads specs and is reused.
- **CLI:** `src/cli/trace.ts` — `TraceCommand extends BaseCommand`, `ambykit trace [feature] [--json]
  [--gate]`; registered in `src/cli/index.ts`. Never writes (FR-011, US-7).
- **Citation rule (FR-002, FR-007):** a test title matches only when it begins with one or more
  qualified IDs `NNN:FR-###` (separated by `,` or space) followed by `:`. A bare `FR-###` never
  matches; it is reported `ambiguous` when more than one feature defines it, else `unqualified`
  (both listed with the uncited tests, with a hint). A test with a skip/todo form is listed
  `skipped` and never covers (edge case, FR-003 scope).
- **Test discovery:** files named `*.test.*` or `*.spec.*` (`ts tsx js jsx mjs cjs`) under the project
  root, skipping `node_modules`, `dist`, `coverage`, `.git`, `.worktrees`, `.amby`, `specs`.
  Overridable in `.amby/config.json` as `trace: { roots?: string[]; ignore?: string[] }` (zod, optional).
- **Dashboard (FR-012–014):** `readFeatures` also keeps each spec's requirements; the project read in
  `checkouts.ts` runs one trace scan and attaches `coverage {covered,total}` to each `FeatureRow`
  (optional field, absent when the feature has no requirements). One-shot and `--json --overview`
  show it; the interactive view gets a quality panel (uncovered requirements + `analyze` findings).
  Plain text: `cov 3/5`, no glyph or color dependency.
- **Converge (FR-015, FR-016, FR-021):** `src/prompts/converge.md` tells the QA role to run
  `ambykit trace <feature> --json` first (skip silently if it cannot run), then read `tests.md`, then
  spend tokens only on what remains; gap tasks cite `(closes NNN:FR-###)` by ID. Claude's emitter
  today grants a scoped shell only for `ambykit activity`; it is generalized to any `ambykit <verb>`
  the prompt invokes so converge gets `Bash(ambykit trace:*)` and nothing wider. **Batch 0 (Q-07):** this
  emitter change (T031) is a foundation built FIRST, because specs 019, 021 and others whose prompts call
  `ambykit` verbs depend on it.
- **Integration steps (Q-11):** the golden-fixture re-record and `ambykit sync` (T033/T034/T094) run once
  per integration batch after lanes merge, never inside a lane branch.
- **JSON contract (FR-008):** `specs/024-trace/contracts/trace-json.md`; `{ version: 1, … }`, fields
  are only ever added.

## Phased approach

- **Phase 0 — Research (done in this plan):** existing tests name requirements as a *suffix*
  (`… (FR-001)`, e.g. test/claude-emitter.test.ts), so the prefix rule leaves them uncited, as US-2
  allows. Vitest forms in use: `it(`, `test(`, `it.each(`, `it.skipIf(`; 4 backtick titles, no
  interpolated ones needing evaluation. `.each` titles are not expanded (listed uncited, noted).
- **Phase 1 — Foundation:** report types + pure parsers + `buildMatrix` + fs edge, fully unit-tested
  with fixtures (no CLI yet). Contract: `contracts/trace-json.md`.
- **Phase 2+ — Features, by priority and dependency:** US-1/US-2 command → US-5 converge → US-7
  additive proof → US-3 `--json`/`--gate`/deliberate → US-4 dashboard → US-6 test design → polish.
- Every new test is named `024:FR-###: …` so the feature traces itself (SC-006, Principle 5).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `buildMatrix` over specs + scanned tests, no model call (`trace.ts`, `trace-io.ts`) |
| FR-002, FR-007 | `trace-cite.ts` prefix parser; bare IDs never match, reported ambiguous/unqualified |
| FR-003 | `uncovered[]` with id + text from `trace-requirements.ts` |
| FR-004, FR-005 | `orphans[]` (cites unknown id) and `uncited[]` (no id), reported separately |
| FR-006 | optional feature argument resolved like `activity` (ref or dir) |
| FR-008 | `--json` with versioned shape, documented in `contracts/trace-json.md` |
| FR-009 | `--gate` flag → exit 1 when `uncovered` is non-empty (deliberate excluded), else 0 |
| FR-010 | `uncovered: FR-### — reason` lines read from `tests.md` via 021's `parseTestDesign`, fallback `spec.md` |
| FR-011, US-7 | no write call in `trace*.ts` or the command; asserted by a read-only test |
| FR-012, FR-013, FR-014 | `FeatureRow.coverage`, one-shot/`--json` figure, interactive quality panel, plain `cov n/m` |
| FR-015, FR-016, FR-021 | converge prompt + Claude emitter scoped shell + golden re-record + `ambykit sync` |
| FR-017, FR-018 | `trace-design.ts` reads cases through 021's `parseTestDesign`; absent `tests.md` ⇒ requirement-only report |
| FR-019 | optional fields only; before/after test on existing command output |
| FR-020 | one "Citing requirements" section in `docs/cli-reference.md` |
| US-1…US-7 | phases in `tasks.md`, one phase per story |
| SC-001 | perf test: 200 test files + 30 features under 1 s |
| SC-002, SC-003 | polish task records the repo baseline; new features follow the convention |
| SC-004 | converge reads one JSON instead of all tests (prompt change); no automated measure, see risks |
| SC-005, SC-006 | tests named with qualified IDs; polish task runs `ambykit trace 024` expecting full coverage |

## Open decisions (default chosen)

1. **Gate flag name:** `--gate` (roadmap says "an optional exit code"). Default `--gate`.
2. **Deliberate-uncovered syntax (resolved, Q-06):** one line `uncovered: FR-### — <reason>` (bullet
   optional) in `tests.md`, else in `spec.md`. Spec 021 owns the `tests.md` grammar and now accepts this
   line in addition to its section form `- FR-###: deliberately uncovered — reason`; trace reads
   `tests.md` only through 021's exported `parseTestDesign`, never a second grammar.
3. **`tests.md` case format (US-6) (resolved, Q-06):** 024 ADOPTS 021's format
   `- [TC-001] [US-1#2] [FR-001] auto — name → expected` (criterion refs are 021's positional `US-n#k`).
   The provisional `- C-### [automate|manual] covers: …` format is dropped. `trace-design.ts` stays one
   isolated module wrapping `parseTestDesign`, so a later format change is a one-file change.
   Ordering: every trace task that reads `tests.md` (US-3 uncovered, US-6 design) builds AFTER 021's
   format tasks (021 T001, T010, T013).
4. **Describe-level citation:** only `it`/`test` titles are read; an ID in a `describe(...)` name does
   not cite the tests beneath it (needs an AST). Listed as a known limit in docs.
5. **Quality view key:** `c` toggles the panel in the interactive dashboard. Verify the key is free
   against `src/cli/ui/dashboard/help-overlay.ts` at build time (spec 023 uses `g`, spec 029 uses `l`).
6. **Bare `FR-###` when only one feature defines it:** reported `unqualified`, still not matched —
   FR-002 is strict and FR-007 only names the multi-feature case; flagged as a spec ambiguity.

## Risks & decisions

- **Existing tests stay uncited** (suffix style `(FR-001)`): intentional and additive. Retrofitting is a
  per-feature follow-up, not part of 1.5. The baseline task records the numbers (SC-002).
- **Text scan can mis-read titles** (template literals with interpolation, titles built by variables):
  listed uncited, never guessed (Principle 4 spirit). `.each` titles are not expanded.
- **Budget (SC-001):** scan on every dashboard run. Mitigation: single pass, size cap per file, ignore
  list, perf test. If it misses the budget, cache by file mtime inside the process only (no cache files).
- **Converge saving (SC-004)** has no automated measure; verified by reading the emitted prompt and a
  manual sample run, recorded in the checkpoint.
- **Cross-spec:** 021 owns the `tests.md` format (decisions 2–3); 032 owns the converge gap trend, which
  this plan leaves out of the quality view (spec US-4).
- **Principle 7:** nothing is written outside the repo; `trace` never edits specs or tests.

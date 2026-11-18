---
feature: 030-spec-v2-and-migrate
status: draft
created: 2026-11-18
---

# Implementation Plan — Spec format v2 and migrate

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor `@../../.amby/constitution.md`. Reference spec by ID — do not restate it.
> The format itself is decided: `@../026-spec-format-v2-spike/decision.md` (cite `026:D-#`, `026:R-#`, `026:F-#`).
> No `ui.md`: no new screen; the only visible output is CLI text (warning, migrate summary, writer messages).

## Technical context

- **Stack:** TypeScript, Node ≥ 20 today and ≥ 22 after this feature, ESM (`.js` import suffixes), Vitest. YAML parsing
  reuses what is already a dependency: `gray-matter`'s YAML engine (`matter.engines.yaml`), as the spike did. No new runtime
  dependency (Principle 3 spirit: nothing for the user to install).
- **Reference implementation (port, do not import):** `spikes/026-spec-format-v2/` — `model.mjs` (the comparable model),
  `read-v2.mjs` (`splitFrontmatter`, `frontmatterOf`, `isV2Spec`, `readSpecV2`, `scanBlocks`, `readTasksV2`),
  `migrate.mjs` (`migrateSpec`, `migrateTasks`, `migrateTree`, `summarize`), `compare.mjs`, `lanes-merge.mjs`, and the fixtures
  in `spikes/026-spec-format-v2/fixtures/{edge-rich,malformed}`. The spike proved identical models for all 26 own specs (126
  stories, 817 tasks, 193 phases) and an idempotent, skip-and-list `migrate`. Nothing under `spikes/` is imported by `src/`
  or the tests of shipped code except as copied fixtures.
- **One model, already in the code.** The model that 026 says plugins and tools may assume is exactly what the shipped
  parsers return: `StoryProgress` and `TaskLine` (`src/core/dashboard.ts`) and `PhaseVerify` (`src/core/markers.ts`). So the
  v2 reader returns **those types**, and nothing downstream (dashboard, analyze, lanes, graph, trace, MCP) changes shape.
  A new file `src/core/spec-format/model.ts` re-exports them with the dispatcher's result type.
- **Existing readers that must go through the dispatcher** (found by grep for `parseStories|parseTasks|parsePhases|parseMarkers`):
  `src/core/features.ts` (`readFeatures`), `src/core/checkouts.ts`, `src/core/dashboard.ts` (`computeDashboard`),
  `src/core/burndown.ts` (history via `git cat-file --batch`), `src/cli/lane.ts` (`git show :N:tasks.md` and
  `git show <branch>:specs/<f>/tasks.md`), `src/cli/dashboard.ts`, `src/core/query.ts` (MCP read tools),
  `src/core/tasks-edit.ts` (MCP `tickTask`/`setStoryStatus`), `src/core/fleet/{flow-input,run-flow}.ts`, and `src/core/lanes.ts`
  (`mergeCheckoffs`, manifests). Specs 028/029/031/032 add more; the guard test (T015) fails on any direct import of the v1
  parsers outside the dispatcher, so they cannot regress.
- **Constraints driving choices:** zero model tokens, local, no network (P3); prose is never rewritten (D-6); migrate is
  non-destructive by construction (write each file once, complete or not at all, read-back check, hash compare); the dashboard
  one-shot stays under 1 s (FR-022); no user-level files (P7); every FR gets a test named `030:FR-###` and typecheck + tests
  pass (P5); prompts and templates stay under today's caps (`test/prompts-020.test.ts` implement < 3000, tasks < 3000).
- **Release coupling:** the reader, `migrate` and the writer ship in one release (`026:R-1`); 2.0 reads 1.x with a warning,
  2.1 refuses (FR-013) — the refusal path is built and tested now, dormant until the version gate.

## The v2 format (decided by 026, restated as the contract this plan implements)

```
spec.md   ---                                 tasks.md  ---
          format: 2                                       format: 2
          feature: 030-… / title / status                 feature: 030-…
          created, branch                                 created
          depends-on: [019, 023-dependency-graph]   # optional, feature-level (C-2)
          stories:                                ---
            - id: US-1                           ## Phase 1 — Setup
              priority: P1                       - [x] [T001] [US1] description         # checkbox, [P], [US#], markers stay inline
              status: draft                      - **Verify:** — removed from prose; lives in the block
              depends-on: [US-1, "019:US-1"]     ```yaml
              blocked-by: []                     files:
          ---                                      T001: [src/a.ts, test/a.test.ts]
          ### US-1 — Title                         T002: [src/b.ts]
                                                 verify:
                                                   check: "`npm test` passes"
                                                   result: passed        # passed | failed | unverified
                                                   why: ""               # required when failed
                                                 ```
```

- Spec: headings keep `### US-n — Title` only (no `(priority: Pn)`); the `- **status:**`, `**depends-on:**`, `**blocked-by:**`
  bullets move to `stories:`; `Why this priority` and `Independent test` bullets stay prose. Story `status` is any string; the
  five known values are canonical, others warn (026 "What 027 may assume").
- Tasks: one `yaml` fence per phase after its task list, with top-level `files` and `verify` keys only. A fence with other
  top-level keys together with `files`/`verify` is an error with `file:line` (`026:D-10`); a fence with neither key is foreign and
  ignored. The reader also accepts the per-task layout (one fence under each task), `migrate` writes only per-phase (`026:D-2`).
- A task absent from `files`, or with `[]`, reads as `paths: [], pathIssue: "missing"` exactly like a 1.x task with no group
  (C-6); a glob path gives `pathIssue: "glob"` as today.
- The `**Checkpoint:**` line stays prose. Markers `⚠ BLOCKED:` and `↪ DEVIATION:` stay on the task line (`026:D-5`).
- Detection (FR-019, C-1): `spec.md` is v2 iff frontmatter `format: 2`; story data without it → v2 + warning; `tasks.md` is v2
  iff `format: 2` in its frontmatter or at least one valid ours-fence. Per file, never per project.

## Architecture

Pure core, effects at the edges. New code is small and sits beside the existing parsers:

```
src/core/spec-format/model.ts          result types (re-export StoryProgress, TaskLine, PhaseVerify; FormatIssue; Format = 1|2)
src/core/spec-format/frontmatter.ts    splitFrontmatter / parseFrontmatter with 1-based line numbers (port of read-v2.mjs)
src/core/spec-format/detect.ts         detectSpecFormat(text), detectTasksFormat(text)  (FR-019)
src/core/spec-format/read-spec.ts      readSpecV2(feature, text) → stories + feature meta (+ depends-on) + issues
src/core/spec-format/read-tasks.ts     scanBlocks, readTasksV2 → TaskLine[] + PhaseVerify[] + issues (phase and task layouts, D-10)
src/core/spec-format/dispatch.ts       readSpec / readTasks / readPhases: choose v1 parsers or v2 readers per file; tally format
src/core/spec-format/legacy.ts         LegacyTally, legacyWarningLine(), legacyEnabled(config, env), refuseLegacy(version) (FR-012/013)
src/core/spec-format/write.ts          format-aware targeted edits: setTaskFiles, setVerifyResult, setStoryStatus (FR-020)
src/core/migrate/safety.ts             unsafe-condition scan (FR-006 list), model equality read-back, content hash compare (FR-024)
src/core/migrate/convert-spec.ts       v1 spec text → v2 text (+ minimal frontmatter, + priority strip, + dual-write)
src/core/migrate/convert-tasks.ts      v1 tasks text → v2 text (per-phase blocks; verify moves; dual-write)
src/core/migrate/run.ts                walk specs/, plan per file, atomic write (temp + rename), summary records
src/core/migrate/summary.ts            per-feature summary text with +/- lines and skip reasons (FR-008)
src/core/config-schema.ts              CONFIG_SCHEMA_VERSION=2, readSchemaVersion, upgradeConfig(raw) pure (FR-014)
src/cli/migrate.ts                     MigrateCommand: [feature] --dry-run --diff --dual-write (extends BaseCommand)
src/cli/edit.ts                        EditCommand: `edit files|verify|status` (writer, FR-020)
src/cli/node-guard.ts                  checkNode(version): string | null (FR-015) — pure, no imports beyond node:process
src/cli/index.ts                       becomes a tiny launcher: guard first, then `await import("./main.js")`
src/cli/main.ts                        the former index.ts body (registry, main(), isMain) — exports `main` for tests
```

- **Dispatcher contract.** `readSpec(feature, text, ctx)` and `readTasks(text, ctx)` always return `{ stories|tasks, phases, format,
  issues }`. For a 1.x file `format = 1` and the arrays are exactly what `parseStories`/`parseTasks`/`parsePhases` return today
  (the v1 functions stay as the v1 implementation; they are not deleted). `ctx.tally` collects format counts so the CLI edge prints
  the one-line warning once per run. Reading old revisions (burndown's blobs, lane's `git show`) calls the same dispatcher on the
  blob text — format is decided from the content (D-9).
- **Issues, not exceptions.** Readers return `FormatIssue { file, line, kind, message }`. `analyze` lists them (errors for broken
  structured data, warnings for status oddities, missing marker, prose/structured disagreement) and exits non-zero on errors;
  `readFeatures` surfaces them through the existing `ParseIssue` channel (`computeDashboard(root, issues)`), never throwing.
- **Targeted edits, never re-serialization.** The writer and the MCP `setStoryStatus` change one scalar line inside the YAML text
  (find the story's `- id:` item, its `status:` line, replace the value) so diffs stay minimal and comments survive. After every
  write the writer re-reads the file and refuses (restoring the original text) if the model differs from the intended change.
- **Legacy warning edge.** `BaseCommand` gets one hook after `execute()`: if the run's `LegacyTally.v1 > 0`, `--json` was not
  given and `legacyEnabled()` (config `legacyWarning !== false` and env `AMBYKIT_LEGACY_WARNING !== "0"`), print one line to stderr:
  `N file(s) use the 1.x spec format (read as before). Run \`ambykit migrate\` to upgrade; support ends in 2.1.` (C-5).
  `check` additionally lists the feature names (US-6) as a notice, exit status unchanged.
- **2.1 refusal.** `refuseLegacy(packageVersion)` is true from `2.1.0`; the dispatcher then returns an issue
  `legacy-format-refused: <file> — migrate with the 2.0 tool` instead of parsing. Tested with an injected version.
- **Node guard.** `src/cli/index.ts` (the `bin` target) shrinks to: read `process.versions.node`, call `checkNode`, print and
  `process.exit(1)` if below 22, else `await import("./main.js")`. The static-import graph of the CLI is therefore never loaded on
  an old Node (a Node 20 `SyntaxError` on newer syntax would otherwise precede the message). `main` stays exported (from `main.ts`
  and re-exported by `index.ts`) because `test/cli/help-warning.test.ts` imports it from `src/cli/index.js`.
- **Config.** `loadConfig` stays read-only; it returns the parsed object and `schemaVersion` is a new optional key in the zod
  schema (`src/core/types.ts`). `upgradeConfig(raw)` is pure: adds `schemaVersion: 2`, keeps all other keys including unknown
  ones, returns `{ config, changed }`. Only `migrate` calls it and writes (C-4). A `schemaVersion` greater than 2 → read-only
  with the message "config is from a newer AmbyKit; upgrade the tool"; unparseable → report file and parse error, never write.
- **Graph (US-9, FR-016).** `FeatureSnapshot` (`src/core/overview-types.ts`) gains optional `dependsOn?: string[]` (feature-level,
  from frontmatter `depends-on`, normalized to directory names by number/slug). `buildGraph` (`src/core/graph.ts`) adds a feature
  edge `{from, to, via: []}` for each declared dependency (additive `declared: true` in `graph-types.ts`), reports an unknown
  feature as a `broken` edge with reason `unknown-feature`, and keeps derived edges from story-level `NNN:US-#` unchanged. A 1.x
  feature has no declared edges. The `--json` shape only gains the optional key (graph `version` stays `1`).
- **Writer command.** `ambykit edit files <feature> <T###> <path…>`, `ambykit edit verify <feature> <phase> --result=passed|failed|unverified
  [--why=<text>]`, `ambykit edit status <feature> <US-#> <status>` (`status` reuses `STORY_STATUSES` from `tasks-edit.ts`, plus
  warning-only unknown values stay readable but the writer accepts only the five). Output is one line (`T004 files set: src/a.ts`).
  In a 1.x file the same command edits the trailing group, the `**Verify:**` suffix or the `**status:**` bullet, using the existing
  `tasks-edit.ts` code, so prompts need no format branch (US-10, US-11).
- **MCP parity (FR-018).** `src/core/tasks-edit.ts` (`tickTask`, `setStoryStatus`) and `src/core/query.ts` keep their signatures
  and JSON shapes; they call the dispatcher for reads and `spec-format/write.ts` for the story-status edit when the file is v2
  (`tickTask` only flips `[ ]`→`[x]` on the task line, which is identical in both formats). Parity tests run the same scenario on a
  1.x feature and its migrated twin and compare the results.
- **Migrate algorithm** (port of `migrate.mjs`, hardened):
  1. Find features: `specs/NNN-*/` in the *current* checkout only (never other worktrees, US-5); optional feature argument.
  2. For each of `spec.md`, `tasks.md`: read bytes; hash; skip if already v2 (`format: 2`) → `unchanged`.
  3. `safety.scan(text)` → skip with reason for each FR-006 condition (prose metadata, duplicate/conflicting bullets, markup in a
     code fence, mixed EOL, BOM, two Verify lines, repeated task id). Specs without frontmatter get minimal frontmatter (reported).
  4. Convert to v2 text (preserve every untouched byte, keep the file's EOL), strip `(priority: Pn)` from story headings and
     record it for the preview, optionally keep v1 lines (`--dual-write`).
  5. Read back with the dispatcher; compare the model to the model of the original; mismatch → skip with reason, original kept.
  6. Unless `--dry-run`: re-read the file, compare hash with step 2 (changed → skip, "edited while migrating"), write to
     `<file>.migrate-tmp` in the same directory, `rename` over the original. `--dry-run` creates no temp file (FR-007).
  7. After all features: if the project config has no `schemaVersion`, `upgradeConfig` and write it (unless dry-run).
  8. Print summary: per feature per file `converted +A -R | unchanged | SKIPPED <reason> (fix: <what>)`, then totals and the 1.x
     warning sentence (FR-025). `--diff` prints each unified diff. Dirty tree: `git status --porcelain -- <files>` before writing → warn and name files (FR-011), do not abort.
  Interruption safety follows from step 6: a file is either wholly old or wholly new; a rerun skips converted files (idempotent, FR-009/010).
- **Prompts and templates (US-11, FR-017).** Instead of teaching two formats, the five prompts tell the assistant to **use the writer
  command** for story status, task files and Verify results, and to tick task checkboxes directly. The 1.x/v2 difference lives in
  the writer, not the prompt text, which keeps the prompts short (P3). Concretely: `src/templates/spec.md` and `src/templates/tasks.md`
  become v2 (frontmatter `stories:`, per-phase block); `/amby.specify` writes `stories:` (not bullets) and sets story `status: draft`;
  `/amby.tasks` writes tasks without the trailing `(file/path)` group, one `yaml` block per phase, the Verify check in `verify.check`;
  `/amby.implement` ticks, runs `ambykit edit status/verify` (Claude's shell grant already covers `ambykit <verb>` from 024); `/amby.revise` and
  `/amby.converge` change `status:` and append gap tasks through the same carriers; all five end with "run `ambykit analyze`; fix any
  file:line error it reports" (R-2). Size guard tests keep each prompt under its cap (raise only with a measured reason).

## Requirements → design

| FR | Design |
|---|---|
| FR-001, FR-019 | `detect.ts`, `read-spec.ts`; `format: 2` marker; warning when absent |
| FR-002 | `read-tasks.ts` (`scanBlocks`, phase and task layouts) |
| FR-003, FR-004 | `FormatIssue` channel; structured wins; no v1 fallback when a v2 marker or `stories:` is present |
| FR-005, FR-006, FR-008 | `migrate/convert-*.ts`, `safety.ts`, `summary.ts` |
| FR-007, FR-023 | `migrate/run.ts` flags `--dry-run`, `--diff`, `--dual-write` |
| FR-009, FR-010, FR-024 | atomic write, hash compare, read-back (`safety.ts`, `run.ts`) |
| FR-011 | `git status --porcelain` check in `run.ts` |
| FR-012, FR-013 | `legacy.ts` + `BaseCommand` hook; `refuseLegacy` |
| FR-014 | `config-schema.ts`, `migrate/run.ts` step 7 |
| FR-015 | `cli/node-guard.ts`, `cli/index.ts` launcher, `package.json` engines, CI matrix |
| FR-016 | `graph.ts` feature edges; `features.ts` reads frontmatter `depends-on` |
| FR-017 | five prompts + two templates; size-cap tests |
| FR-018 | dispatcher routing; parity tests (1.x vs migrated twin) for dashboard, analyze, lane merge, MCP tick/status |
| FR-020 | `spec-format/write.ts`, `cli/edit.ts`, `tasks-edit.ts` |
| FR-021 | `dispatch.ts` + guard test (T015) + history readers (`burndown.ts`, `cli/lane.ts`) |
| FR-022 | `test/perf/dashboard-v2.test.ts` on a migrated copy of the repo specs |
| FR-025 | migrate output and `docs/migration.md` |

## Phases (what the tasks implement; detailed in `tasks.md`)

1. **Setup** — record the v1 baseline (model + command outputs on every own spec) and port the spike fixtures.
2. **Foundational (sequential, no behavior change)** — `spec-format/{model,frontmatter,detect,dispatch}.ts` with v1 delegation; route every
   reader through it; guard test. Gate: the existing suite and the Setup baseline stay byte-identical.
3. **US-1 v2 spec reader**, 4. **US-2 v2 task reader** — sequential (both extend `spec-format/read-*.ts` and `dispatch.ts`).
   Gate: fixture parity — the same model from v1 and v2 forms of every edge-rich fixture, malformed fixtures give located errors.
5. **Parallel lanes (one phase, four disjoint file sets):**
   - **Lane A — migrate** (`src/core/migrate/`, `src/cli/migrate.ts`): US-3, US-4, US-5.
   - **Lane B — config + Node 22** (`src/core/config-schema.ts`, `src/core/types.ts`, `src/cli/node-guard.ts`, `src/cli/main.ts`, `package.json`, `.github/workflows/`): US-7, US-8.
   - **Lane C — writer + MCP parity** (`src/core/spec-format/write.ts`, `src/core/tasks-edit.ts`, `src/core/query.ts`, `src/cli/edit.ts`): US-10.
   - **Lane D — graph edges** (`src/core/graph*.ts`, `src/core/overview-types.ts`): US-9.
   Shared registry (`src/cli/index.ts`), `BaseCommand`, docs and `AGENTS.md` are touched only in the sequential phase after the lanes.
6. **Integration and legacy handling (sequential)** — register `migrate` and `edit`, `LegacyTally` hook, `check` notice, config upgrade wired into migrate,
   2.1 refusal, parity tests across 1.x and migrated twin (SC-003), perf test (SC-008).
7. **US-11 prompts and templates (sequential, one owner)** — five prompts, two templates, size tests, golden re-record is NOT done here.
8. **Docs and polish** — `docs/artifacts/{spec,tasks}.md`, `docs/migration.md`, `docs/cli-reference.md`, `docs/workflow.md`, README, site CLI page,
   `AGENTS.md` verb line, changelog; docs-sync check.
9. **Release gates (person + integration batch, last)** — assistant YAML-edit trial (SC-009), goldens once, `sync` ×2, then the dogfood: `migrate --dry-run`
   then `migrate` on AmbyKit's own `specs/` in a final commit (SC-001/SC-007), second run no-op (SC-002), re-run the full suite on the v2 tree.
   030's own `tasks.md` stays in 1.x format until this step.

## Test strategy

- Tests cite requirements by qualified id at the start of the title: `it("030:FR-009: a second migrate changes nothing", …)` (024's rule).
- **Baseline (Phase 1):** `test/fixtures/spec-model-v1.json` generated from the shipped parsers over every `specs/*/{spec,tasks}.md` (like
  `tasks-baseline-020.json`); a test asserts the dispatcher's v1 path equals it for the *committed* specs (new specs added later regenerate it).
- **Fixtures (Phase 1, ported):** `test/fixtures/spec-format/{edge-rich,malformed,unsafe}/…` from `spikes/026-spec-format-v2/fixtures` plus
  the unsafe-spec set the spike generated (`results/us2-skips.txt`): prose-meta, two-status, mixed-eol, fenced, bom, dup-verify, dup-id, no-frontmatter.
- **Parity (SC-003, FR-018):** helper `withMigratedCopy(fixtureProject)` runs migrate into a temp dir; one test runs `dashboard --json --overview`,
  `analyze --json`, `lane` planning/merge (`mergeCheckoffs`), `tickTask` and `setStoryStatus` on the 1.x project and its twin and compares results.
- **Safety:** `--dry-run` leaves the tree hash identical and no `*.migrate-tmp`; interruption test kills the writer between temp write and rename
  (inject a failing `rename`) and reruns; edited-meanwhile test changes the file between read and write; read-back test injects a converter bug.
- **Perf (SC-008):** migrate a temp copy of the real `specs/` and time `dashboard` one-shot (< 1000 ms, the same budget and method as
  020's one-shot test); record the numbers in `notes.md`.
- **Prompt caps:** extend `test/prompts-020.test.ts` style tests in a new `test/prompts-030.test.ts` (sentences pinned, sizes capped).
- **Manual gates (person):** T-trial (SC-009) and the dogfood run; `? unverified` until a person confirms.

## Risks and how this plan covers them

| Risk | Covered by |
|---|---|
| 1.x binaries silently lose data on v2 files (`026:R-1`) | `format: 2` marker, `check` notice, migrate output sentence (FR-025), ships together, `--dual-write` |
| YAML typo disables a phase (`026:R-2`) | writer command, `analyze` located errors, assistant trial, never re-serialize |
| Prompts corrupt v2 (`026:R-3`) | prompts use the writer; size caps; Phase 7 owner; trial |
| Dashboard budget (`026:R-8`) | perf test + one YAML parse per file only; `readFeatures` unchanged otherwise |
| History/branch readers (`026:R-6`, `D-9`) | dispatcher by content; guard test; burndown and `lane` tests with mixed-format blobs |
| Merge hotspots (`AGENTS.md` verb line, `README.md`, `src/cli/index.ts`, `src/core/index.ts`) | lanes never touch them; registration and docs are sequential Phase 6/8 tasks |
| Prompt/golden churn with 028/029/031/032 | 030 merges before they build prompts; goldens re-recorded once at integration |
| Spike code diverges from shipped code | port with tests; spike fixtures copied; spike migrate kept as an oracle in Phase 6 parity (not imported) |

## Open decisions (defaults chosen; reversible)

- **D1 — Verb for the writer:** `ambykit edit …` (subcommands `files|verify|status`). Alternative: separate verbs. Default keeps one new verb in docs-sync.
- **D2 — Where the legacy warning is printed:** a `BaseCommand` hook (one place) rather than in each reader. Reversible.
- **D3 — Dormant 2.1 refusal:** built and tested in 2.0 so 2.1 is a one-line version bump; remove if the maintainer prefers writing it in 2.1.
- **D4 — `index.ts` split into launcher + `main.ts`:** required for a reliable Node 22 message; tests keep importing `main` from `index.js`.
- **Owner-only:** the 2.1 gate confirmation and the CI Node matrix change (drop 20) need the release maintainer; both are recorded in `tasks.md` as person tasks.

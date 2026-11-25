---
feature: 035-drop-1x-reading
status: draft
created: 2026-11-25
---

# Implementation Plan — Drop reading of 1.x specs

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`. Reference by ID; nothing here restates the spec.
> **Ships in 2.1, after 2.0 (spec 034) is released.** No code is removed before the go decision (US-1) is accepted (FR-001, FR-002).
> `spec.md` is still `status: draft` (no open markers); the owner decisions below should be folded into it with `/amby.revise` before Phase 3.

## Technical context

- **Stack:** TypeScript (ESM, NodeNext), Node ≥ 22, Vitest. No new dependency.
- **What 030 already built, verified by reading the repository on 2026-11-25 (`main` 2d4e2f2):**
  - `src/core/spec-format/dispatch.ts`: `readSpec`/`readTasks` decide the format **per file** (`detect.ts`: `format: 2` marker, `stories:` key,
    or one of our yaml fences); v1 files go to the shipped parsers. `readSpecV1`/`readTasksV1` are the forced 1.x readers, used only by
    `src/core/migrate/safety.ts` for its "before" model.
  - `src/core/spec-format/legacy.ts`: the one-line notice per run (`legacyWarningLine`, printed by `BaseCommand.printLegacyWarning`, off in
    `--json`, off via `legacyWarning: false` or `AMBYKIT_LEGACY_WARNING=0`), `check`'s per-feature notice (`legacyFeatures`), and a refusal that
    is **already built and tested**: `refuseLegacy(version)` turns true from `REFUSE_FROM = "2.1.0"`; the dispatcher then returns an empty
    read plus one `legacy-format-refused` error issue. Commands do not stop on that issue today: they render an empty feature.
  - The refusal message says to migrate "with AmbyKit 2.0 (`npx @ambystech/ambykit@2.0 migrate`)", and `docs/migration.md` → Timeline says 2.1
    "tells you to migrate with 2.0". Both contradict US-2 and US-5 (`migrate` stays in 2.1). The spec wins; Phase 5 fixes both.
  - **The v2 readers reuse the 1.x parsers:** `read-spec.ts` calls `parseStories` for headings, `read-tasks.ts` calls `parseTasks` and
    `parsePhases` for the checkbox lines and phase numbering. So "no module imports the removed parsers" (US-3) means removing their
    **1.x-only parts** (heading `(priority: Pn)`, story bullets `**status:**`/`**depends-on:**`, the trailing `(paths)` group on a task line,
    the plain-text `**Verify:**` line and its result suffix), not the functions.
  - History readers: `burndown.ts` reads blobs through `readTasks` without a version, so after the refusal a 1.x revision counts as zero tasks
    (wrong, not skipped). `metrics/model.ts` pins `HISTORY_VERSION = "2.0.0"`, so it reads 1.x history forever. `lane.ts` reads a branch with
    `git show` through `readTasks`.
  - `legacyWarning` lives in `src/core/config.ts` (zod schema) and `src/core/types.ts`. `migrate --dual-write` writes files that carry both
    formats; they have the v2 marker, so they read as v2.
  - Tests that exist only to prove 1.x reads as before: `test/core/spec-model-baseline.test.ts` + `test/fixtures/spec-model-v1.json`,
    `test/tasks-baseline-020.test.ts` + `test/fixtures/tasks-baseline-020.json`, the 1.x halves of `spec-format-dispatch`, `spec-format-lane-parity`,
    `mcp-parity-030`, `test/cli/legacy-warning.test.ts`, most of `spec-format-legacy`, and `test/release/legacy-fixtures.test.ts` (034:FR-006, the
    2.0 gate's C2). About 90 test files write a `tasks.md`; most of them, and most fixture helpers in `test/helpers/`, write the **1.x** format.
    They all break the day 1.x is refused. This is the largest piece of work in the feature.
  - 030 T090 (the confirmed 2.1 gate wording) is **still open**. US-1 needs it.
- **Constraints:** Principle 5 (no FR loses its last test; `trace` before and after), Principle 6 (the go decision is evidence, not a date),
  Principle 7 (no telemetry, FR-003; the owner judges the evidence and publishes), Principle 3 (one refusal message, listed once).

## Architecture

1. **The go decision is a numbered record (US-1; FR-001, FR-002, FR-003).** `/amby.decide` writes `.amby/decisions/ADR-NNN.md` ("End 1.x
   reading in 2.1"), cited by this feature, with one row per condition: the confirmed gate wording from 030 T090, the adoption window
   (D-6), "no open `migrate` data-loss defect during the window", and the documented path for remaining 1.x users. Each row has a date and
   evidence that needs no user tracking (npm download counts, GitHub issues, known projects). `status: proposed` until the owner accepts it.
2. **An explicit switch instead of a version gate (FR-002).** Replace `REFUSE_FROM`/`refuseLegacy(version)` with one constant,
   `LEGACY_READING: "on" | "off"` in `legacy.ts` (the pattern of `SPLIT_ACTIVE` and `RUN_STABILITY`). Today a 2.1.0 bump for **any** reason
   would end 1.x reading without a decision. A test refuses `"off"` unless the ADR is `accepted` and every condition row is met (as 033's test
   does for `RUN_STABILITY`). This step does not remove anything and can land before 2.0 (D-8).
3. **`migrate` gets its own 1.x reader (FR-009, FR-010).** `src/core/migrate/v1-reader.ts` takes the 1.x-only parsing out of `dashboard.ts` and
   `markers.ts` (heading priority, story bullets, the `(paths)` group, Verify lines and glyphs). The shared line parsing stays where it is and
   the v2 readers keep using it. `readSpecV1`/`readTasksV1` move there. `migrate`'s safety check keeps comparing "before" (this reader) and
   "after" (the v2 reader), so its rules, `--dry-run`, `--diff`, `--dual-write` and idempotence are unchanged.
4. **One preflight that stops before anything is read or written (US-2; FR-004, FR-005).** `src/core/spec-format/legacy-scan.ts`
   `findLegacyFiles(root)` lists every `specs/*/spec.md` and `tasks.md` (main checkout and the worktrees `checkouts.ts` already finds) that
   `detect*` calls 1.x. `detect` is kept: it is how a 1.x file is recognised. `BaseCommand.run` calls it before `execute()` when the switch is
   `"off"`. If anything is found it prints **one** message (every file, grouped by feature, then `ambykit migrate --dry-run` and
   `ambykit migrate`) and exits 1 with nothing on stdout. In `--json` it prints `{ "error": { "kind": "legacy-format-refused", "files": [...] } }`.
   Exempt commands, by a `readsSpecs` getter on the command: `migrate`, `init`, `sync`, `update`, `add`, `restore`, `--help`, `--version`. The MCP
   server stays up and returns the same refusal for each tool call that would read a spec. `ambykit edit` and `tasks-edit.ts` are covered by the
   same preflight.
5. **The 1.x path goes (US-3; FR-006, FR-007, FR-011).** The dispatcher loses its v1 branch: `readSpec`/`readTasks` on a 1.x file return the
   `legacy-format-refused` issue (defence in depth behind the preflight). Removed: the tally, `printLegacyWarning`, `showsLegacyWarning`,
   `check`'s notice, `legacyEnabled`, `legacyWarningLine`, `AMBYKIT_LEGACY_WARNING`. `legacyWarning` stays in the zod schema as an accepted,
   ignored key; `loadConfig` reports it with one notice per run. History readers follow D-2 (answered: keep history): burndown, `lane` and
   metrics read earlier 1.x revisions through `migrate`'s 1.x reader; only the current files are refused. `spec-format-guard.test.ts` is rewritten:
   only `src/core/migrate/` may import the 1.x reader.
6. **Tests: convert first, then delete (US-4; FR-008).** The fixture helpers (`tasks-fixture`, `spec-project`, `dashboard-fixture`,
   `dashboard-perf-fixture`, `fleet-*`, `lane-fixture`, `trace-fixture`, `graph-fixtures`, `worktree-fixture`, `git-history-fixture`,
   `metrics-history`, `tabs-fixture`, `run-1.6-fixture`) write v2. Inline 1.x literals in tests go through one test helper, `asV2(text)`, which
   runs `migrate`'s converters. Tests whose subject is the format itself get literal v2 text. `trace --json` for every feature is saved before
   the deletions and compared after (SC-004).
7. **Docs (FR-010).** The 1.x format description now spread through `docs/artifacts/spec.md` and `tasks.md` moves to one reference page,
   `docs/format-1x.md`, linked from `docs/migration.md`. The artifact pages describe v2 only. `docs/migration.md` → Timeline,
   `docs/cli-reference.md` and the changelog say what 2.1 does.

## Phases

- **Phase 1 — Setup:** research (parser split inventory, every 1.x test and fixture writer, history reader behaviour, the 2.0 timing
  baseline) → `research.md`; owner decisions D-1..D-8 recorded in `spec.md` via `/amby.revise`.
- **Phase 2 — US-1, the go decision:** ADR drafted, a test tying the switch to it, the owner fills the evidence and accepts. **Nothing after this
  phase starts until the ADR is accepted** (FR-001, SC-001).
- **Phase 3 — Foundational:** the switch, `migrate`'s own reader, `findLegacyFiles`. Behaviour of 2.0 unchanged while the switch is `"on"`.
- **Phase 4 — US-2:** the preflight, the message, `--json`, MCP, exemptions.
- **Phase 5 — US-3:** dispatcher v1 branch, notice, tally and key removed; config tolerance; history readers; guard; budget.
- **Phase 6 — US-4:** fixtures converted, `trace` snapshot, 1.x-only tests deleted and listed, `trace` compared.
- **Phase 7 — US-5:** `migrate` end to end on 2.1; the 1.x format reference page; docs and changelog.
- **Phase 8 — Release:** goldens and sync once, full gate, switch flipped to `"off"`, owner cuts 2.1.0.

## Requirement map

| FR | How | Proof |
|---|---|---|
| FR-001 | ADR with the gate wording and dated evidence per condition | `test/release/legacy-decision.test.ts` reads the ADR |
| FR-002 | `LEGACY_READING` switch; `"off"` refused by test unless ADR accepted and all rows met | same test |
| FR-003 | ADR evidence column allows only public sources; no network call or ID in the code | ADR review (T012) + a grep test for telemetry calls in `src/` |
| FR-004 | preflight in `BaseCommand.run`, message with file and both migrate commands, exit 1, nothing written | `test/cli/legacy-refused.test.ts` (tree hash before/after) |
| FR-005 | one message listing every 1.x file, grouped by feature; v2 features not processed | same test, mixed project |
| FR-006 | v1 branch, notice, tally, env var removed; `legacyWarning` accepted and ignored with one notice | `test/core/config-legacy-key.test.ts`, guard test |
| FR-007 | history readers read 1.x revisions through `migrate`'s 1.x reader (D-2) | `burndown` and `lane` tests with a 1.x revision |
| FR-008 | fixtures converted, 1.x-only tests deleted and listed, `trace` compared | `research.md` table + `trace` diff (T053) |
| FR-009 | `migrate/v1-reader.ts`, same safety rules | existing migrate tests + `test/cli/migrate-2-1.test.ts` |
| FR-010 | `docs/format-1x.md` | `test/docs/format-1x.test.ts` (page exists, linked, names every 1.x element) |
| FR-011 | preflight shares the file list with the readers; budget tests unchanged | `dashboard-perf`, `dashboard-fleet-perf` + T044 comparison |

## Risks & decisions (owner)

**D-1..D-8 are answered (2026-11-25); see `spec.md` Clarifications.** D-2 keeps history; every other decision follows the recommendation below.

- **D-1: the go decision and the gate wording.** 030 T090 is still open; US-1 cannot be written without it. Recommended: confirm it together with
  T002, worded as "2.1 stops reading 1.x once 2.0 has been out for the adoption window, `migrate` has had no open data-loss issue in it, and
  `docs/migration.md` documents the path."
- **D-2: history readers (FR-007).** The spec says skip and count. AmbyKit's own history, and every user's, is almost entirely 1.x before
  their migration, so burndown and the 032 metrics would lose everything before that day. Recommended: history readers keep reading old
  revisions through `migrate`'s 1.x reader (it must exist anyway, FR-009). Only **current** files are refused. That needs `/amby.revise` to
  reword FR-007, US-3's third criterion and SC-003 ("except inside `migrate` and the history readers"). Default if not answered: the spec as written.
- **D-3: the refusal points to `ambykit migrate` in 2.1, not to 2.0.** This follows US-2 and US-5, against the current code and docs. No decision
  needed unless the owner wants 2.1 to drop `migrate` (then US-5 changes).
- **D-4: `AMBYKIT_LEGACY_WARNING`.** Recommended: ignored silently. It is an environment switch, not config, and a notice for it would be noise.
- **D-5: `--dual-write` in 2.1.** Recommended: keep it. Some tools on a team may still run 1.x, and dual-write files read as v2.
- **D-6: the adoption window.** The spec gives no length. Recommended: at least 8 weeks and at least one 2.0.x patch after 2.0.0. The
  docs already say "no migration issue open for a release".
- **D-7: the exit code of the refusal.** Recommended: 1, as for any command error. `--json` gets the error object; MCP returns it per call.
- **D-8: land the explicit switch (Phase 3, T021) before the 2.0 cut.** Today the version gate would end 1.x reading on any 2.1.0 bump, even
  without US-1. Recommended: yes, as a small 2.0 change; the rest of 035 waits for 2.1.
- **Risk: test conversion size.** About 90 test files write `tasks.md`. Helpers first, then `asV2` for inline literals, keep diffs mechanical,
  one commit per helper group. If it grows past one release, split US-4 into its own feature.
- **Risk: performance.** The preflight reads every spec and tasks file. It must hand its reads to the dashboard instead of reading twice;
  T044 compares one-shot and `--json` against the 2.0 numbers recorded in T001.
- **Risk: 034:FR-006 loses its test.** `test/release/legacy-fixtures.test.ts` proves 2.0 still reads 1.x. In 2.1 it becomes "1.x fixtures are
  refused and `migrate` converts them" (T052), so 034:FR-006 keeps a citing test.

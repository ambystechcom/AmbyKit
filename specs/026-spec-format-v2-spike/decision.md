---
feature: 026-spec-format-v2-spike
title: Spec format v2 — decision and findings
status: decided             # decided | extended | withdrawn
created: 2026-11-16
---

# Decision — Spec format v2

> Written at the end of spec 026's spike (FR-001, FR-011). Cite a decision as `026:D-#`, a risk as `026:R-#`.
> Evidence is in `spikes/026-spec-format-v2/` (scripts and `results/`); nothing there ships (FR-012, FR-014).

## Recommendation: GO, with the changes in D-1 to D-10

The decided split works: **feature and story metadata in frontmatter, per-task file ownership and phase Verify data in
fenced YAML blocks, prose untouched.** A prototype reader produces one identical model from the v1 and the v2 form of every
one of AmbyKit's 26 own specs (126 stories, 817 tasks, 193 phases), in three block layouts, and a prototype `migrate`
converts all 26 without losing a prose line and without a second run changing anything. The cost is +3.2% tokens overall
(per-phase layout), and the cost is real for old binaries: a 1.x CLI reading a v2 file loses story status, dependencies,
ownership and Verify results without an error (R-1). That is acceptable for 2.0 only because `migrate` ships with the reader
(D-6).

## Decisions

- **D-1 — Carrier split.** Confirmed as decided in the roadmap: frontmatter holds `stories:` (id, priority, status,
  `depends-on`, `blocked-by`); fenced `yaml` blocks in `tasks.md` hold `files` (ownership) and `verify`; everything else
  stays markdown. *Evidence:* `us1-real-v1.txt`, `us2-v2-vs-v1.txt` (26/26 identical in 3 layouts).
- **D-2 — Block layout: per phase.** One block per phase: `files:` maps `T###` to a list, `verify:` holds `check`,
  `result` (`passed|failed|unverified`) and `why`. Task lines lose the trailing `(path)` group and stay checkbox lines, so
  check-off and `mergeCheckoffs` keep working. Per-task blocks parse to the same model but are not adopted: they cost 2.6
  points more tokens (+5.8% vs +3.2%) and 2.7 times the lines in a large file, and they only avoid one conflict that
  `mergeCheckoffs` already resolves. *Evidence:* `us3-tokens.md`, `us3-merge.md`, `us3-readability.md`.
  The reader accepts both layouts (it costs nothing and the model is identical), but `migrate` writes the per-phase one.
- **D-3 — Explicit marker.** Add `format: 2` to the spec frontmatter so detection is not a heuristic. The prototype
  detects v2 by the `stories` list; the one place that hurt was a spec with broken YAML, which fell through to "v1" until
  detection learned that a `stories:` key with unparseable YAML is still v2 intent. An explicit marker removes that class.
  (Not prototyped.)
- **D-4 — Frontmatter is authoritative; headings keep titles only.** The prototype copies priority into frontmatter and
  leaves `(priority: P1)` in the heading, so the two can drift (the reader warns when they disagree). New specs should
  carry priority in frontmatter only and the heading should carry the title; `migrate` may strip the heading annotation
  in 2.0 (it edits prose, so it is a 030 decision, not made here).
- **D-5 — Markers stay inline; Verify moves to the block.** `⚠ BLOCKED:` and `↪ DEVIATION:` are state an implementer sets
  on a task line, are visible to a person scanning the list, and parse identically in v1 and v2 (the model is equal across
  all 26 specs and the fixtures). Only the phase Verify line becomes `verify:` in the block. The result is then a field
  to edit rather than a glyph appended to a sentence (R-2).
- **D-6 — `migrate` is the only supported route, and it is non-destructive by construction.** It moves data and never
  rewrites prose; `--dry-run` writes nothing; a second run changes nothing; it reads every converted file back and skips
  it if the model differs from the v1 model. It leaves these untouched and lists them: metadata inside a prose sentence,
  duplicate or conflicting metadata bullets, metadata or task markup inside a code fence, mixed line endings, a BOM,
  a phase with two Verify lines, a phase that repeats a task id. A spec with no frontmatter gets a minimal one and is
  reported. *Evidence:* `us2-dryrun.txt`, `us2-idempotence.txt`, `us2-skips.txt`. On AmbyKit's own specs nothing was skipped.
- **D-7 — No dual-write by default.** `--dual-write` (keep the v1 bullets, groups and Verify lines, add the v2 data) lets a
  1.x binary read converted files with no loss and the 2.x reader sees 0 drift warnings, but it costs +12.2% tokens
  and doubles every edit. It is a transitional escape hatch for teams with a pinned 1.x CI, not the format.
- **D-8 — Requirement ids stay in prose.** `trace` (024) reads `FR-###` lines and test names, not frontmatter;
  `ambykit trace --json` is byte-identical on the v1 and the v2 copy (`t051-shipped-cli-on-v2.md`). Listing requirement
  ids in frontmatter would be additive later and is not needed now.
- **D-9 — History is read by the dispatcher.** Anything that parses an old `tasks.md` revision (burndown reads history,
  `lane` reads `git show <branch>:tasks.md`) must go through the per-file dispatcher, because a repo's history holds both
  formats.
- **D-10 — Unknown yaml fences are foreign.** A fenced `yaml` block in `tasks.md` is ours only if it has a top-level
  `files` or `verify` key; a block with those keys and any other key is an error with `file:line`. Documentation examples
  in other fences are ignored.

## Findings that shaped the decisions

| # | Finding | Evidence |
|---|---|---|
| F-1 | Every real spec converts, in every layout, with identical models. 52 files, 0 skipped. | `us2-v2-vs-v1.txt` |
| F-2 | 1.x on a v2 copy: 126/126 story statuses lost, 86/126 dependency lists lost, 793 of 817 ownership entries lost (the others had none), 61 phases' Verify data lost (of 193 phases). No error. | `us2-v1-reader-on-v2.txt` |
| F-3 | The shipped `analyze` on the v2 copy lists all 126 stories as buildable (2 on v1) and reports 60 tasks with no usable path. | `t051-shipped-cli-on-v2.md` |
| F-4 | Nine real tasks have a prose parenthetical before the real ownership group, e.g. `(SC-002/003)`. v1 reads the last group, so they are fine; after migration a 1.x reader sees a phantom path. The v2 reader gets them right and warns once. | `us2-v2-vs-v1.txt` warnings |
| F-5 | Ownership edits and ticks share a line in v1, so changing one task's ownership while another lane ticks its neighbour conflicts. With blocks they do not (5 of 5 scenarios merge without a person per-phase, 3 of 5 in v1). Adjacent ticks still conflict in v1 and per-phase; `mergeCheckoffs` resolves that already. | `us3-merge.md` |
| F-6 | Spec metadata can be loaded without prose: the frontmatter is ~26 lines, 4.5% of the tokens of the v1 spec files. Tasks cannot: ownership lives inside its phase. | `us3-tokens.md` |
| F-7 | A spec whose frontmatter had broken YAML was silently read as v1 (error lost). Fixed in the prototype; D-3 removes the cause. | `us1-fixtures.txt` |
| F-8 | Per-phase blocks put ownership far from its task (a 20-row block after the list in `014`); a person loses at-a-glance ownership. This is the main usability cost of D-2. | `us3-readability.md` |

## Risks and how each is covered

| ID | Risk | Covered by |
|---|---|---|
| R-1 | An old binary reads v2 files without error and loses the data (F-2, F-3). | `migrate` ships with the new reader (D-6); v2 files carry `format: 2` (D-3) so the 2.x CLI can say what it found; `--dual-write` for pinned CI (D-7). 030 should also make the 2.x `check` report specs still in v1. |
| R-2 | One YAML typo makes a whole phase's ownership and Verify unusable (v1 loses one line). | The reader reports `file:line` and `analyze` fails on it (errors, never guesses; `us1-fixtures.txt`). 030 should give implementers a command that writes the data (ownership, `result`) so they do not hand-edit YAML; the same idea as 025's directive writer. |
| R-3 | The phase prompts tell the assistant to patch `- **status:**` bullets, tick boxes and append a glyph to the Verify line. | `/amby.implement`, `/amby.tasks`, `/amby.specify`, `/amby.revise` and `/amby.converge` need new instructions (030). Inventory lists them. This is the largest work item and the main source of token risk (Principle 3). |
| R-4 | Plugin API (027) freezes a shape that v2 then changes. | 027 binds to the model below, not to files (see "What 027 may assume"). |
| R-5 | Lane planning and the check-off-aware merge break. | Reader yields the same paths (F-1); `mergeCheckoffs` works on both layouts (`us3-merge.md`). Lane manifests are not format-dependent. |
| R-6 | History and branch readers see mixed formats (D-9). | One dispatcher for every reader of `tasks.md`, including `git show` paths. |
| R-7 | Assistants outside AmbyKit read raw markdown. | Frontmatter plus prose stays plain markdown; the blocks are readable YAML in code fences. No tool is required to read the file. |
| R-8 | Dashboard and analyze performance. | The reader is the shipped parsers plus one YAML parse per file; no timing regression was measured and none is expected, but 030 must re-run the dashboard's 1-second budget (SC-001 of 020). |

## What specs 027 and 030 may assume

**027 (plugin API).** The model a plugin receives is exactly the prototype's, which is the data the dashboard and analyze
use today, so the API can be written now and survive v2:
- `meta`: `feature`, `title`, `status`.
- `stories[]`: `id`, `displayId`, `title`, `priority`, `status`, `dependsOn[]`, `blockedBy[]`. Status is a string:
  do not hard-code the five known values (the reader warns on others instead of rejecting).
- `tasks[]`: `id`, `done`, `story`, `description`, `phase`, `parallel`, `paths[]`, optional `pathIssue`
  (`missing|glob`), optional `blocked`, `deviation`.
- `phases[]`: `phase`, `title`, `tasks`, optional `check`, `result`, `why`, `duplicates`.
- Plugins read the model through the API, never markdown or YAML. The format is then free to change under them.

**030 (spec v2 and `migrate`).**
- Frontmatter `format: 2` plus `stories:` as prototyped (D-1, D-3); per-phase blocks (D-2); markers inline (D-5).
- `migrate` behavior as in D-6, including `--dry-run`, skip-and-list and the read-back check; the prototype in
  `spikes/026-spec-format-v2/migrate.mjs` is a working reference, not shipped code.
- The reader reads v1, v2 and mixed features per file; both 1.x and 2.x specs stay readable until 2.1 (roadmap).
- Prompt rewrites (R-3) and a writer for ownership and Verify results (R-2) are 030's scope.
- Open for 030, not decided here: stripping `(priority: P1)` from headings (D-4), and whether `migrate` should also
  offer to remove the Verify result glyph convention from `docs/`.

## Cross-check with 020 and 024 (T051)

- **020 (BLOCKED, DEVIATION, Verify).** Markers parse identically (the fixtures include a marker followed by a backticked
  `(path)` and an empty-reason marker). Verify moves to the block; the reader reproduces `check`, `result` and `why`
  for all 193 real phases and the fixtures (`us1-fixtures.txt`, `us2-v2-vs-v1.txt`). One gap recorded: 020's
  `path-after-marker` finding depends on the group being on the line; after migration the group is not, so the finding
  can no longer fire for migrated tasks (the condition cannot occur), which is desired. A marker followed by a group the
  migrator did not extract stays on the line and still fires. **No blocking gap.**
- **024 (trace).** `ambykit trace --json` is byte-identical on the v1 and v2 copies, because it reads requirement
  lines and test names, which v2 does not touch. A spec 024 reading `tests.md` (021) is unaffected: `tests.md` is not
  migrated (plans and `tests.md` stay out of v2 per 030). **No gap.**

## Timebox and what was not answered

Within the 5-day box: every task through T051 finished and T052's gate found nothing unfinished, so FR-013 did not apply.
Not answered, and where it goes:
- The 1-second dashboard budget with the v2 reader (R-8): 030.
- Behavior with Windows editors that add a BOM or convert endings mid-session (migrate skips both; no live test): 030.
- Whether assistants edit YAML blocks reliably in practice (R-2, R-3): needs a trial with a real assistant; none was run here.
- Concurrent hand-edit during a migration (spec edge case): not tested; `migrate` writes each file once after reading
  it, so a concurrent edit between read and write would be lost. 030 should write via temp-file-and-rename and compare
  the file's hash first.

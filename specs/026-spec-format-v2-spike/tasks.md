---
feature: 026-spec-format-v2-spike
created: 2026-11-16
---

# Tasks — Spec format v2 spike

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. Time box: 5 working days, hard stop at
> T052. Prototype code lives only under `spikes/026-spec-format-v2/` (never `src/`, never packed).

## Phase 1 — Setup  (day 1)

- [x] [T001] Create the scratch directory with a README stating how to run it and that nothing here ships (spikes/026-spec-format-v2/README.md)
- [x] [T002] [P] Build the repo and confirm `dist/core/dashboard.js` imports from a plain `.mjs`; record the Node version (spikes/026-spec-format-v2/NOTES.md)
- [x] [T003] [P] Inventory every reader of status, depends-on, blocked-by and trailing file paths in `src/core` and `src/cli`, with file and line (spikes/026-spec-format-v2/INVENTORY.md)
- **Verify:** README states the not-shipped rule, `node -e "import('./dist/core/dashboard.js')"` exits 0, and INVENTORY lists each reader with file and line. ✓ passed

## Phase 2 — Foundational  (day 1–2, blocks all story work)

- [x] [T010] Define the one comparable model: feature meta, stories, tasks with paths and phase verify, plus the format used per file (spikes/026-spec-format-v2/model.mjs)
- [x] [T011] [P] Write the baseline script that builds the v1 model for every spec through the built `parseStories` and `parseTasks` (spikes/026-spec-format-v2/baseline.mjs, spikes/026-spec-format-v2/model-v1.json)
- [x] [T012] [P] Write the compare script: structural model diff that lists every differing field with its location (spikes/026-spec-format-v2/compare.mjs)
- [x] [T013] [P] Hand-write v2 fixtures and v1 twins for the spec edge cases: cross-feature story link, clarification marker, CRLF, unusual path characters, malformed block, mixed formats (spikes/026-spec-format-v2/fixtures/)
- **Verify:** model-v1.json has an entry for every `specs/` directory that has a spec.md, and compare reports zero differences for two identical models and names the field for a mutated one. ✓ passed

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Implement the v2 reader: frontmatter through gray-matter, fenced yaml blocks through its yaml engine, errors carrying file and line (spikes/026-spec-format-v2/read-v2.mjs)
- [x] [T021] [US1] Implement the dispatcher that detects v1 or v2 per file and reports which parts of a mixed feature used which format (spikes/026-spec-format-v2/read.mjs)
- [x] [T022] [US1] Run the reader over every fixture pair: twins give identical models and malformed inputs report their location (spikes/026-spec-format-v2/results/us1-fixtures.txt)
- [x] [T023] [US1] Run the reader over every real spec as v1 and compare with the baseline model (spikes/026-spec-format-v2/results/us1-real-v1.txt)
- **Checkpoint:** US-1 is demoable: one model from both formats, with locations on bad input.
- **Verify:** all fixture twins show zero differences, every malformed fixture prints a file and line, and every real v1 spec compares identical to model-v1.json. ✓ passed

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [US2] Implement migrate v1 to v2 for spec.md and tasks.md with the per-phase block layout, a dry-run diff summary, and skip-and-list for specs it cannot convert safely (spikes/026-spec-format-v2/migrate.mjs)
- [x] [T031] [US2] Add the per-task block layout as a second migrate option (spikes/026-spec-format-v2/migrate.mjs)
- [x] [T032] [US2] Dry-run over a temporary copy of `specs/` and prove nothing was written by hashing the tree before and after (spikes/026-spec-format-v2/results/us2-dryrun.txt)
- [x] [T033] [US2] Run migrate twice for real on the copy and prove the second run changes nothing and prose lines are unchanged (spikes/026-spec-format-v2/results/us2-idempotence.txt)
- [x] [T034] [P] [US2] Read the converted copy in both layouts and compare with the baseline model (spikes/026-spec-format-v2/results/us2-v2-vs-v1.txt)
- [x] [T035] [P] [US2] Run the current built parsers on the converted copy and record, per field, whether 1.x can still read it (spikes/026-spec-format-v2/results/us2-v1-reader-on-v2.txt)
- **Checkpoint:** US-2 is demoable: safe, repeatable, previewable migration on AmbyKit's own specs.
- **Verify:** the dry-run tree hash is unchanged, the second real run produces an empty diff, every v2 model equals the baseline or each difference is listed, and every skipped spec is listed untouched. ✓ passed

## Phase 5 — User story US-3  (priority: P2)

- [x] [T040] [P] [US3] Count characters, words and approximate tokens for at least three specs in v1, per-phase layout and per-task layout, and tabulate (spikes/026-spec-format-v2/measure.mjs, spikes/026-spec-format-v2/results/us3-tokens.md)
- [x] [T041] [P] [US3] Lane-merge experiment on a temporary git repo: two branches tick different tasks and edit different blocks, then merge, for each layout (spikes/026-spec-format-v2/lanes-merge.sh, spikes/026-spec-format-v2/results/us3-merge.md)
- [x] [T042] [US3] Read the three converted samples and write the readability note: where prose or data hurt, and whether an assistant can load less than in 1.x (spikes/026-spec-format-v2/results/us3-readability.md)
- **Verify:** the token table covers at least three specs in all three formats, the merge note says clean or conflicted for each layout, and the readability note answers whether less can be loaded. ✓ passed

## Phase 6 — User story US-4  (priority: P1)

- [ ] [T050] [US4] Write the decision with numbered decision IDs: chosen format and block layout, evidence by reference, risks to dashboard, analyze and the plugin API with how each is covered, and what specs 027 and 030 may assume (specs/026-spec-format-v2-spike/decision.md)
- [ ] [T051] [US4] Cross-check the decision against spec 020 markers and the data spec 024 reads, and record any gap in the decision (specs/026-spec-format-v2-spike/decision.md)
- [ ] [T052] [US4] Day-5 gate: if any task above is unfinished, write the partial findings and the unanswered questions into the decision and ask a person whether to extend (specs/026-spec-format-v2-spike/decision.md)
- **Checkpoint:** US-4 is demoable: specs 027 and 030 can cite decision IDs and start.
- **Verify:** decision.md states the format, lists each risk with its coverage, says what 027 and 030 may assume, and every decision ID is unique.

## Phase 7 — Polish

- [ ] [T090] Confirm no shipped output changed: typecheck and the full test suite pass and the only changed paths are under `spikes/` and this spec directory (spikes/026-spec-format-v2/results/final-check.txt)
- [ ] [T091] Delete the temporary specs copy and keep only results and scripts (spikes/026-spec-format-v2/work/)
- **Verify:** `npm run typecheck` and `npm test` pass and `git status` lists nothing outside `spikes/026-spec-format-v2/` and `specs/026-spec-format-v2-spike/`.

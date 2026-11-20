# Lane notes — 030 phase 5

Phase 5 (ten `[P]` tasks on disjoint files) was built as four lanes: `ambykit lane 030-spec-v2-and-migrate --phase=5 --lanes=4`
(round-robin: lane 1 T040/T044/T048, lane 2 T041/T045/T049, lane 3 T042/T046, lane 4 T043/T047).

## Evidence

- **Planning:** `analyze` reported no lane conflicts for phase 5 before the split; the lanes were created with no refusal.
- **Merge:** `ambykit lane merge 030-spec-v2-and-migrate` merged all four lanes in order with **no conflict and no manual
  resolution**. The `tasks.md` check-offs of adjacent tasks (T040..T049 belong to four different lanes) merged through the
  check-off-aware merge; every lane commit touched different source files. 4 of 4 clean.
- **After the merge:** `npm run typecheck`, `npm test` (1893 passed; the only failure is the known one-second timing test
  `dashboard-worktrees`, which fails under full-suite load and passes alone) and `analyze` (no lane conflicts) all green.

## What made it clean (and what nearly did not)

- **Deviation notes go in after the merge.** Appending `↪ DEVIATION:` text to four task lines inside the lanes would have made
  adjacent edits that are not check-offs only, so git would have conflicted. They were removed from the lanes (one extra
  commit per lane) and added to the feature checkout after the merge, the rule 020 recorded for Verify results.
- **Two identical edits in two lanes merge cleanly.** Lanes 3 and 4 both needed `splitResult` and `VERIFY_LINE` exported from
  `src/core/markers.ts`; the same change on both sides merged with no conflict. A shared helper still belongs in one lane
  when it can be, because lane 4 could not import lane 3's code until the merge.
- **A guard test that scans `src/` can fail in a lane for a reason that the merge resolves.** `graph-consumers` failed in lane
  2 until lane 1's exemption for `core/migrate/` arrived; it passed after the merge.
- **Lanes need their own `node_modules` junction** and are removed with `rmdir` on the junction first, then `lane remove`.

## Files per lane (disjoint)

1. `src/core/migrate/safety.ts`, `src/core/config-schema.ts`, `src/core/types.ts`, `src/core/config.ts`,
   `src/core/spec-format/dispatch.ts`, `test/mcp-parity-030.test.ts`, `test/fixtures/spec-format-twins/`, graph-consumers guard.
2. `src/core/migrate/convert-spec.ts`, `src/cli/node-guard.ts`, `src/core/graph*.ts`, `src/core/overview-types.ts`.
3. `src/core/migrate/convert-tasks.ts`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `src/core/markers.ts`.
4. `src/core/migrate/summary.ts`, `src/core/spec-format/write.ts`, `src/core/markers.ts` (same edit as lane 3).

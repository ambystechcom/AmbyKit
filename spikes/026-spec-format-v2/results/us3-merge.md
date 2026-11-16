# US-3 — lane merge experiment

Two lane branches edit the same `tasks.md` (6 parallel tasks in one phase). Merge with git; on a conflict try AmbyKit's shipped `mergeCheckoffs` (the check-off-only rule `ambykit lane merge` uses). Final text is read back with the v2 reader and checked for both lanes' changes.

| Layout | Scenario | Outcome | Both changes present |
|---|---|---|---|
| v1 | S1 two lanes tick ADJACENT tasks (T001 / T002) | git CONFLICT, resolved by check-off-aware merge | yes |
| v1 | S2 two lanes tick DISTANT tasks (T001 / T005) | clean (git alone) | yes |
| v1 | S3 lane A ticks T003, lane B records the phase Verify result | clean (git alone) | yes |
| v1 | S4 lane A ticks T002, lane B changes T001's ownership | CONFLICT, needs a person | n/a |
| v1 | S5 lane A ticks T004, lane B changes T005's ownership (distant) | CONFLICT, needs a person | n/a |
| v2 phase blocks | S1 two lanes tick ADJACENT tasks (T001 / T002) | git CONFLICT, resolved by check-off-aware merge | yes |
| v2 phase blocks | S2 two lanes tick DISTANT tasks (T001 / T005) | clean (git alone) | yes |
| v2 phase blocks | S3 lane A ticks T003, lane B records the phase Verify result | clean (git alone) | yes |
| v2 phase blocks | S4 lane A ticks T002, lane B changes T001's ownership | clean (git alone) | yes |
| v2 phase blocks | S5 lane A ticks T004, lane B changes T005's ownership (distant) | clean (git alone) | yes |
| v2 task blocks | S1 two lanes tick ADJACENT tasks (T001 / T002) | clean (git alone) | yes |
| v2 task blocks | S2 two lanes tick DISTANT tasks (T001 / T005) | clean (git alone) | yes |
| v2 task blocks | S3 lane A ticks T003, lane B records the phase Verify result | clean (git alone) | yes |
| v2 task blocks | S4 lane A ticks T002, lane B changes T001's ownership | clean (git alone) | yes |
| v2 task blocks | S5 lane A ticks T004, lane B changes T005's ownership (distant) | clean (git alone) | yes |

Summary (scenarios merging without a person): v1 3/5, v2 phase blocks 5/5, v2 task blocks 5/5
Summary (scenarios that git alone merges cleanly): v1 2/5, v2 phase blocks 4/5, v2 task blocks 5/5

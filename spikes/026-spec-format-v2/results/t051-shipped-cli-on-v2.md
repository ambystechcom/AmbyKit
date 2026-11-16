# T051 — the shipped (1.x) CLI reading a v1 copy and a v2 copy of this repo's specs

| Signal the shipped CLI computes | v1 copy | v2 copy (per-phase) |
|---|---:|---:|
| `analyze` exit status | 1 | 1 |
| stories with a status (`dashboard --json`) | 126 | 0 |
| stories reported done | 117 | 0 |
| stories with depends-on | 86 | 0 |
| `analyze`: stories listed as buildable now | 2 | 126 |
| `analyze`: tasks reported without a usable file path | 0 | 60 |
| `analyze`: lines asking to add a Verify line | 0 | 2 |

`ambykit trace --json` (spec 024 reads requirement ids from prose and test names): byte-identical in v1 and v2.

Reading: a 1.x binary on v2 files does not crash and trace is untouched, but story status, depends-on, ownership and Verify results are not seen: the data the dashboard and analyze exist to show.

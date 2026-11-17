# Spike 026 — spec format v2 (scratch, NOT shipped)

**Nothing in this directory ships.** It is outside `src/` (not typechecked), outside the `package.json`
`files` list (not packed) and outside `test/`. It is a time-boxed experiment (spec 026, 5 working days);
a later spec (030) decides what, if anything, is adopted. Prototype code lives only here.

## How to run

All scripts are plain `.mjs`, run from the repo root after `npm run build` (they import the built
`dist/core/*.js`, so "what dashboard and analyze use today" is the real code).

```bash
npm run build
node spikes/026-spec-format-v2/baseline.mjs                  # v1 model of every spec -> model-v1.json
node spikes/026-spec-format-v2/run-fixtures.mjs              # US-1: fixture twins + malformed inputs
node spikes/026-spec-format-v2/run-real-v1.mjs               # US-1: real specs read as v1 vs baseline
node spikes/026-spec-format-v2/migrate.mjs <dir> [--dry-run] [--layout=phase|task] [--dual-write]
node spikes/026-spec-format-v2/run-us2.mjs                   # US-2: dry-run, idempotence, v2-vs-v1, 1.x reader
node spikes/026-spec-format-v2/measure.mjs                   # US-3: token table
bash spikes/026-spec-format-v2/lanes-merge.sh                # US-3: lane merge experiment
```

`run-us2.mjs` builds the scratch copies under `work/` (git-ignored; delete it when done: it holds copies of `specs/`).
`run-cli-check.mjs` needs those copies and runs in the OS temp directory. Run order: `baseline`, `run-fixtures`,
`run-real-v1`, `run-us2`, `measure`, `lanes-merge.sh`, `run-cli-check`.

`migrate.mjs` only ever writes inside the directory it is given. The experiments give it a temporary
copy of `specs/` (the real tree is never modified). Results are written to `results/`.

## Files

`model.mjs` the one comparable model · `read-v2.mjs` v2 reader · `read.mjs` v1/v2 dispatcher ·
`compare.mjs` model diff · `migrate.mjs` v1→v2 · `measure.mjs` token counts · `fixtures/` hand-written twins.
The decision lives in `specs/026-spec-format-v2-spike/decision.md`.

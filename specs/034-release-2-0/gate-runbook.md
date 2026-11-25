# 2.0 gate runbook (owner)

> The person tasks that still stand between `main` and the 2.0.0 cut, in the order to do them, with the exact commands and the file each
> result goes into. `npm run release:check -- --version 2.0.0` reports which gate rows (`gate.md`) are still open.
> Everything an assistant can do is done; what is left needs a person, a real install or a judgement.

## 0. Before you start

```
git switch main && git pull && npm ci && npm run build && npm run build:plugins
npm link            # `ambykit` on PATH is this checkout
ambykit --version   # still 1.6.0 until the release branch bumps it
```

## 1. Runner verification (033 T063, T064)

One record per runner and operating system, in `specs/033-stable-run-and-plugin-api/verification/<runner>-<os>.md`
(`<os>` is `linux`, `macos` or `windows`). The format is in that folder's `README.md`; every line must have a value.

For each of `claude` and `codex`, on each OS you vouch for:

1. `ambykit run --runners` shows the runner, the version it found and `unverified`.
2. In a scratch project, prepare a small feature with `[P]` tasks, then `ambykit worktree <feature>` and `ambykit lane <feature>`.
   `ambykit run` and `--emit-script` both refuse an unverified runner, so the live check runs the runner's own command
   (`RUNNERS[...].invoke` in `src/core/runners.ts`) in a lane directory with the lane prompt `lanePromptText` builds, on stdin.
3. Note: the invocation (on Windows, whether it is `claude.exe` or a `.cmd` shim), how the prompt was delivered, the exit code of a
   finished turn and of a failed one, whether usage was reported, and **whether the edits and the `ambykit activity` reports
   happened** (exit 0 alone does not prove the lane did its work).
4. Write the record, then in `src/core/runners.ts` set `verified: true`, `verifiedOn` (Node names: `linux`, `darwin`, `win32`),
   `verifiedVersion` and `verifiedRange`. `test/core/runner-records.test.ts` fails if a record is missing or incomplete.
5. Update the runner row in `docs/tool-compatibility.md`.

A runner may be verified on one OS only; it is then runnable only there (033 C-3).

## 2. The fleet dogfood (031 T094, 033 T071; gate C3)

One fleet builds **two dependent features of this repository** with a verified runner, with no manual start, order or merge.

1. Pick or write two small features where the second `depends-on` the first (frontmatter `depends-on`). Plan and task both.
   Good candidates are small 2.x items, for example the ADR dangling-citation exit code and something that builds on it.
2. `ambykit run <first> <second> --yes` (add `--unattended` only if you mean it). Watch it in `ambykit dashboard --interactive`, fleet tab.
3. When it finishes, write `specs/033-stable-run-and-plugin-api/dogfood.md` with these lines (all required; `Result` must start with
   `passed`):

```
- **Fleet run id:** <the id `ambykit fleet fleets` shows>
- **Runner:** claude | codex
- **Versions:** ambykit <commit or version>, <assistant> <version>
- **Features:** <first>, <second> (<second> depends on <first>)
- **Result:** passed, <one line: what merged, any retries>
```

4. Record the same run id and result in `specs/031-multi-feature-fleets/research.md` (T094), and in 031 T095 name the runners that were
   verified for it.
5. 033 T072: if it passed, set `RUN_STABILITY = "stable"` in `src/core/run-stability.ts` and drop "(experimental)" from help and docs
   (`test/core/run-stability.test.ts` refuses "stable" without a passing `dogfood.md`). If it did not pass, leave `run` experimental;
   the 2.0 changelog then says so.

## 3. Keys-only dashboard tour (032 T113; gate C4)

`ambykit dashboard --interactive` on this repository, keyboard only, and tick each line:

- [ ] `1` overview, `2` fleet, `3` graph, `4` quality: each tab opens, the tab bar is visible on every tab.
- [ ] `]` and `[` cycle through all four tabs in both directions.
- [ ] `/` then a feature id (for example `032`): the list narrows; `esc` clears it.
- [ ] `/` then a story or task id (for example `US-2` or `T113`): it is found.
- [ ] `s` cycles the state filter through its states; the shared filter line shows it on each list tab; `esc` clears it.
- [ ] Fleet tab: `←` / `→` collapse and expand a feature (with a fleet present).
- [ ] Quality tab: the workflow metrics panel shows values from this repository's history (`ambykit dashboard --json --metrics` gives the same numbers).
- [ ] `?` opens help with the keys above; `esc` closes it; `q` quits.
- [ ] Narrow terminal (about 60 columns): still usable, no wrapped frame.

Record date, terminal, OS and any problem in `specs/032-dashboard-redesign-and-metrics/research.md` under SC-001 and SC-007.

## 4. Assistant trial of v2 files (030 T091)

On a v2 feature (after step 6, or a copy migrated with `ambykit migrate`), run one phase (for example `/amby.implement` on two tasks)
with **two** different assistants. Check that no file is left unreadable (`ambykit check`, `ambykit analyze`) and that every update went
through `ambykit edit` or a checkbox, not a hand edit of the YAML blocks. Record both results in `specs/030-spec-v2-and-migrate/notes.md`.

## 5. Upgrade guide on a real 1.x project (034 T024)

On a **copy** of a 1.x project that is not this repository, follow only `docs/migration.md` ("Upgrade a 1.x project to 2.0").
`ambykit check` and `ambykit analyze` must end clean. Record project, date, steps and problems in `specs/034-release-2-0/rc-report.md`.

## 6. Migrate this repository's specs (030 T095; gate C1, C2) — last commit before the cut

Only when every open branch that touches `specs/` is merged.

```
ambykit migrate --dry-run     # last checked 2026-11-25: 74 to convert, 0 skipped
ambykit migrate
ambykit migrate               # second run must change nothing
npm test && ambykit analyze
```

Also replace `.amby/templates/tasks.md` (and `spec.md`) with the v2 templates from `src/templates/`, then fill gate rows C1 and C2.

## 7. Release candidate and cut (034 T050–T052, T062, T080–T086)

Follow `docs/release.md`: candidate `2.0.0-rc.1` under the `next` dist-tag, try it on another project, read the rollback plan, then the
release branch, `npm run release:check -- --version 2.0.0`, tag, publish and the fresh-install check.

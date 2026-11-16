# Research — Version warning + `update` (Phase 0 decisions)

Decisions with rationale. Feeds `plan.md`; referenced by ID from tasks.

## R-1 — Version-check latency strategy (FR-005/005a, SC-006)

**Options:** (a) bounded-inline refresh on stale cache; (b) detached background process that refreshes
for the next run; (c) check only inside `update`.

**Decision:** (a). The hot path reads only the cached value (sync fs). When the cache is missing or
>1 day old, do a best-effort `fetch` with a short timeout (~500 ms) on interactive human runs only; on
timeout/failure, show no warning (or the last cached value) and continue.

**Rationale:** Warm-cache runs (the norm) add zero cost. A detached refresh (b) is unreliable for a
process that exits in tens of ms — the child is often killed before it writes. (c) makes the warning
too stale. The rare, bounded, once-per-day cold delay is acceptable and clearly beats unreliability.

## R-2 — Determining "latest" (FR-012)

**Decision:** `GET https://registry.npmjs.org/@ambystech/ambykit/latest` via Node 20 global `fetch`
with an `AbortController` timeout; read `.version`. No new dependency, no `npm view` shell-out (faster,
no child process). Both the callout and `update` call the same `version-check.ts` module (single
source of truth).

## R-3 — Cache location (FR-005a, Principle 7)

**Decision:** `~/.ambykit/version-cache.json` → `{ "latest": "1.0.0", "checkedAt": "<ISO>" }`. A
user-level, tool-managed cache (analogous to npm's own caches), created without prompting because it
is not a write into the user's project and is excluded from the `sync`/`check` set. Documented as a
deliberate, non-violating exception to Principle 7's "no user-level writes without consent" (which
targets user *config*, not internal caches).

## R-4 — Installed-version source (FR-013)

**Decision:** `installedVersion()` reads `packageRoot()/package.json` `version` (replacing the hard
`"0.0.0"` consts in `index.ts`/`init.ts`). `isDevPlaceholder(v)` returns true for `0.0.0`; such a
version is treated as current and never warns/downgrades. Comparison is numeric `x.y.z`; pre-release
and build metadata are ignored (no semver dependency added).

## R-5 — Self-update mechanism & post-upgrade prompt refresh (FR-006/011, US-3)

**Decision:** `update` runs `spawnSync("npm", ["install","-g","@ambystech/ambykit@latest"])`. A
non-zero exit (permission error, or an ephemeral `npx` run) → print the exact command and leave the
install intact (no partial state — npm's global install is atomic).

**Critical subtlety:** the *running* process still holds the *old* bundled prompts, so it cannot emit
the new version's prompts in-process after an upgrade. Decision (confirmed with the user): on a
successful upgrade, `update` **stops and instructs the user to re-run `ambykit update`**. The re-run
executes under the freshly-installed binary and performs the in-process prompt refresh. We deliberately
do **not** spawn/re-exec the new binary — a plain re-run is simpler and reliable across every shell,
and avoids fragile PATH/child-process behavior. When the CLI is already current, the same run refreshes
prompts in-process directly.

## R-6 — Project detection at the invocation directory (FR-007/010)

**Decision:** new `projectAtCwd(cwd)` = `existsSync(cwd/.amby) && existsSync(cwd/specs)`. This is
intentionally **not** `findProjectRoot` (which walks up to any ancestor `.amby`): the spec pins
detection to the directory where `update` is invoked (`c:\example1\.amby` + `c:\example1\specs`).

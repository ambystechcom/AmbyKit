# Data model — Version warning + `update`

Entities and invariants. No persistence beyond the user-level cache file.

## VersionInfo
- `installed` — the running CLI version (from `packageRoot()/package.json`).
- `latest` — newest published version, or `null` when unknown (offline/uncached).
- `isOutdated` — `latest != null && !isDevPlaceholder(installed) && compare(installed, latest) < 0`.

**Invariants**
- A dev placeholder (`0.0.0`) is never `isOutdated` (FR-013).
- `latest == null` ⇒ `isOutdated == false` (no warning offline, FR-005).

## VersionCache  (`~/.ambykit/version-cache.json`)
- `latest` — last fetched latest version string.
- `checkedAt` — ISO-8601 timestamp of that fetch.
- **Fresh** when `now - checkedAt < 24h`; a stale/missing cache authorizes one best-effort refresh
  (FR-005a). Excluded from the `sync`/`check` set (Principle 7).

## WarningRender  (output of `versionWarning`)
- Input: `caps`, `installed`, `latest`.
- Output: the callout string, or `""` when suppressed.
- **Suppressed** when: `!isOutdated`, `latest == null`, dev placeholder, `!caps.isTTY`, or `--json`
  (the last two gated by the caller). See `ui.md` VersionWarningCallout states.

## UpdatePlan  (what `ambykit update` decides)
- `cliOutcome` — `updated` | `current` | `manual-required`.
- `from` / `to` — versions, when an upgrade was attempted.
- `inProject` — `projectAtCwd(cwd)` result (`.amby/` AND `specs/` at the invocation dir).
- `promptRefresh` — a `WriteResult` (created/updated/unchanged), or absent when `!inProject`.
- **Nothing-to-do** ⇔ `cliOutcome == current` AND `promptRefresh` has no created/updated → emit exactly
  `Everything is up to date` (FR-009, SC-005).
- After `cliOutcome == updated`, `update` **stops** and instructs the user to re-run `ambykit update`;
  `promptRefresh` is absent that run. The prompt refresh happens on the re-run (now `cliOutcome ==
  current` under the new binary). No in-process refresh follows a successful upgrade (R-5).

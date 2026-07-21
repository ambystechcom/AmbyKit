# Contract — version check, callout, update (interfaces)

Signatures for the new units. Pure logic in `core/`; fs/network/process at the `cli/` edge
(Conventions). Types reference `@../data-model.md`.

## `src/core/version.ts` (pure)

```ts
/** The running CLI version, read from packageRoot()/package.json. */
export function installedVersion(): string;

/** "0.0.0" and other unpublished placeholders → true (never warn/downgrade). */
export function isDevPlaceholder(version: string): boolean;

/** Numeric x.y.z compare (pre-release/build ignored): <0, 0, >0. */
export function compareVersions(a: string, b: string): number;

/** isOutdated per data-model (dev placeholder and null-latest are never outdated). */
export function isOutdated(installed: string, latest: string | null): boolean;
```

## `src/cli/version-check.ts` (edge: fs + fetch)

```ts
export interface VersionCache { latest: string; checkedAt: string; }

/** Sync read of the cache; null when missing/unreadable. The hot path uses ONLY this. */
export function latestFromCache(): string | null;

/** True when the cache is missing or older than 24h (authorizes a refresh). */
export function cacheIsStale(): boolean;

/** Best-effort registry lookup with a timeout; writes the cache on success; null on any failure. */
export function refreshLatest(timeoutMs?: number): Promise<string | null>;
```

**Guarantees**
- `latestFromCache` never performs I/O beyond a single sync file read; never throws (returns null).
- `refreshLatest` never throws and never hangs past `timeoutMs`; on success updates `VersionCache`.

## `src/cli/ui/callout.ts` (pure renderer)

```ts
/** VersionWarningCallout (ui.md). Returns "" when suppressed (not outdated / dev / latest null). */
export function versionWarning(caps: Capabilities, installed: string, latest: string | null): string;
```

**Guarantees**
- Uses only `theme.ts` (`paint`, box glyphs) — no direct ANSI. ASCII box when `!caps.unicode`; no
  color when `!caps.color`. The `!` symbol + "Update available" word carry meaning without color.

## `src/cli/base-command.ts` (hook)

```ts
/** Optional preamble printed before the callout (init → banner()). Default: null. */
protected preamble(): string | null;
// run(): print preamble → if caps.isTTY && !json: print versionWarning(caps, installed, latestFromCache())
//        + fire cacheIsStale() ? refreshLatest() best-effort → execute()
```

## `src/cli/update.ts` + project detection

```ts
// core/paths.ts (or update.ts): detection pinned to the invocation dir, NOT a walk-up.
export function projectAtCwd(cwd: string): boolean; // existsSync(cwd/.amby) && existsSync(cwd/specs)

// UpdateCommand extends BaseCommand { requiresProject = false }
//   1. await refreshLatest(); compute isOutdated
//   2. outdated → spawnSync npm i -g @ambystech/ambykit@latest ; fail → print command (FR-011)
//        success → STOP, instruct "re-run `ambykit update` to refresh prompts" (no re-exec, R-5)
//   3. current → if projectAtCwd(cwd) → buildEmittedFiles+applyFiles refresh (in-process)
//   4. report; "Everything is up to date" when cliOutcome==current && no prompt changes (FR-009)
```

**Guarantees**
- A failed install leaves the existing CLI intact and prints the exact upgrade command (FR-011).
- The in-project refresh uses `buildEmittedFiles`+`applyFiles` unchanged → `check` stays green (FR-007,
  Principle 6). `upgrade` delegates here (FR-014).
```

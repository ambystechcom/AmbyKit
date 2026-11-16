---
feature: 010-version-update
status: draft
created: 2026-07-20
---

# Implementation Plan — Outdated-version warning + `update` command

> The HOW. Satisfies every `FR-###` in `@spec.md` and the signed-off `@ui.md`; honors
> `@../../.amby/constitution.md`. References spec/UI by ID — does not restate them.

## Technical context

- **Stack:** existing AmbyKit CLI — Node ≥ 20, TypeScript (ESM, NodeNext), Vitest.
- **Key libraries:** Node stdlib only — global `fetch` + `AbortController` (Node 20) for the npm
  registry lookup; `node:child_process` (`spawnSync`) for the global install; `node:fs`/`node:os`
  for the cache. **No new dependencies** (Principle 2 mindset — reuse the platform).
- **Constraints driving choices:**
  - Principle 1/2 — the in-project prompt refresh reuses `buildEmittedFiles` + `applyFiles` (the
    `sync` pipeline); `update` is one implementation and `upgrade` becomes a thin alias — no
    duplicated logic.
  - Principle 2 (TUI) — the callout renders only through `theme.ts`/`render.ts`; it is the single
    styling surface, with the same capability degradation as every other component (feature 006).
  - Principle 6 — the in-project refresh must leave `ambykit check` green (byte-for-byte `sync`).
  - Principle 7 — the version cache is a user-level, tool-managed cache (like npm's own), never a
    write into the user's project and never part of the sync check.

## Architecture

Three small units plus two hook points. The **per-command warning** is read-only and cache-fast; the
**`update` command** does the network + install work explicitly.

```
  core/version.ts (pure)
    installedVersion()            reads packageRoot()/package.json  (replaces the "0.0.0" consts)
    compare(a,b) / isNewer        semver-lite compare (numeric x.y.z, ignore pre-release)
    isDevPlaceholder(v)           "0.0.0" → treat as current (FR-013)

  cli/version-check.ts (edge; fs + fetch)
    readCache()  writeCache()     ~/.ambykit/version-cache.json  { latest, checkedAt }   (FR-005a)
    latestFromCache()             sync read only — the hot path never touches the network
    refreshLatest(timeoutMs)      fetch registry /@ambystech/ambykit/latest, short timeout, best-effort

  cli/ui/callout.ts (pure renderer)                     ← ui.md VersionWarningCallout
    versionWarning(caps, installed, latest) : string    box via callout.warn tokens; "" when suppressed

  cli/base-command.ts  run():
    ┌ preamble() hook (init → banner)        ← centralizes banner+callout ordering (Principle 2)
    ├ if caps.isTTY && !--json:  print versionWarning(caps, installed, latestFromCache())   (US-1)
    │        └ if cache stale/missing → refreshLatest() best-effort (bounded, ≤ ~1/day)
    └ execute()                              ← command content

  cli/update.ts  UpdateCommand (BaseCommand, requiresProject=false):     ← US-2/3/4
    1. refreshLatest() (awaited; user asked)  → installed vs latest
    2. outdated → spawnSync npm i -g @ambystech/ambykit@latest
         └ fail (npx/EACCES) → print exact command, install intact              (FR-006/011)
         └ success → STOP and instruct: "Updated to X — re-run `ambykit update`
              to refresh this project's prompts" (the old process can't emit the
              new version's prompts; the re-run does it under the new binary)    (US-3, see Decision)
    3. CLI already current → in-project (`.amby/` AND `specs/` at cwd)?
         └ buildEmittedFiles+applyFiles refresh (the `sync` pipeline)            (US-3)
    4. report: updated / refreshed summary / "Everything is up to date"          (US-4)

  cli/upgrade.ts  → thin deprecated alias delegating to UpdateCommand           (FR-014)
```

### Key decisions (see `research.md`)

- **Hot path never blocks on network.** Every command reads only the cached latest version
  (`latestFromCache`, sync fs read). A stale/missing cache triggers a bounded best-effort
  `refreshLatest` (≤ ~500 ms, once/day) used opportunistically; on timeout the run simply shows no
  warning (or the last cached value) and never hangs (FR-005/005a, SC-006).
- **Project detection for `update` is at the invocation dir**, not a walk-up: `existsSync(cwd/.amby)`
  **and** `existsSync(cwd/specs)` (per spec — `c:\example1\.amby` + `c:\example1\specs`). This is a new
  helper distinct from `findProjectRoot` (which walks up).
- **Single source of truth for "latest"** — both the callout and `update` call `version-check.ts`
  (FR-012).
- **`upgrade` → alias** of `update` (FR-014): `UpgradeCommand` prints a deprecation note and runs the
  `update` path; the logic lives once in `UpdateCommand`.

## Phased approach

- **Phase 0 — Research** → `research.md`: latency strategy (bounded-inline vs background/detached);
  post-upgrade prompt-refresh via re-exec of the new binary; registry endpoint + fetch/timeout; cache
  location vs Principle 7; npx/global-install failure detection.
- **Phase 1 — Foundation** → `data-model.md`, `contracts/version.md`: `core/version.ts`,
  the `version-check.ts` cache/lookup contract, the `versionWarning` renderer signature, and the
  `projectAtCwd()` detector. Replace the `"0.0.0"` version consts in `index.ts`/`init.ts` with
  `installedVersion()`.
- **Phase 2 — US-1 (P1):** `callout.ts` renderer + `design-tokens`-backed box glyphs in `theme.ts`;
  `BaseCommand.run()` preamble+callout hook; cache read + TTY/`--json` gating + best-effort refresh.
- **Phase 3 — US-2 (P1):** `UpdateCommand` CLI self-update (global install else print-command).
- **Phase 4 — US-3 (P1):** in-project prompt refresh (reuse `sync` pipeline) + `projectAtCwd` +
  post-upgrade re-exec so new prompts are emitted; `check` stays green.
- **Phase 5 — US-4 (P2):** result reporting incl. exact `Everything is up to date`; fold `upgrade`
  into a deprecated alias (FR-014).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `run()` prints `versionWarning` after `preamble()`/banner, before `execute()` |
| FR-002 | `callout.ts` renders the box via `component.callout.warn` tokens (theme.ts) |
| FR-003 | Renderer picks ASCII box/arrow glyphs when `!caps.unicode`; no ANSI when `!caps.color` |
| FR-004 | `run()` gates the callout on `caps.isTTY && !flags.json` — suppressed otherwise |
| FR-005 | `latestFromCache` returns null offline → renderer returns ""; refresh is best-effort |
| FR-005a | `version-check.ts` cache `{latest, checkedAt}`, 1-day TTL, short-timeout refresh on miss |
| FR-006 | `UpdateCommand` `spawnSync npm i -g …@latest`; fallback prints the command |
| FR-007 | When CLI is current, `projectAtCwd(cwd)` → `buildEmittedFiles`+`applyFiles` (`sync` pipeline) |
| FR-008 | When CLI already current, `update` proceeds to the in-project prompt refresh |
| FR-009 | Result reporter emits exact `Everything is up to date` when nothing changed |
| FR-010 | No `.amby/`+`specs/` at cwd → skip refresh, report accordingly |
| FR-011 | Install failure (npx/EACCES) → print command, no partial state (spawn is atomic per npm) |
| FR-012 | Callout and `update` both source "latest" from `version-check.ts` |
| FR-013 | `isDevPlaceholder("0.0.0")` → treated current; renderer returns "" |
| FR-014 | `UpgradeCommand` = thin deprecated alias delegating to `UpdateCommand` |
| US-1..US-4 | Phases 2–5 respectively; each independently testable per its spec block |

## Risks & decisions

- **Post-upgrade prompt refresh runs on a re-run, not via re-exec.** A running (old) process still has
  the old bundled prompts, so refreshing in-process after a global install would emit stale prompts.
  Decision (confirmed with the user): after a successful upgrade, `update` **stops and instructs the
  user to re-run `ambykit update`** — the re-run executes under the new binary and does the in-process
  prompt refresh. No spawning/re-exec of the new binary (simpler and reliable across shells).
- **Once/day cold check latency.** The bounded-inline refresh can add up to ~500 ms at most once per
  day on an interactive run; warm-cache runs add zero. FR-005 ("not noticeably delay") is honored in
  the common (warm) case; the rare cold delay is bounded. Detached-background refresh was rejected as
  unreliable for a short-lived CLI (recorded in `research.md`).
- **Global install permissions.** `npm i -g` may hit `EACCES`/sudo needs; handled by the
  print-the-command fallback (FR-011). We do not attempt privilege escalation (Principle 7).
- **User-level cache vs Principle 7.** `~/.ambykit/version-cache.json` is a tool-managed cache (akin
  to npm's), never a project write and excluded from the sync check — noted, not a violation.
- **Version comparison scope.** Numeric `x.y.z` compare, pre-release/build metadata ignored; adding a
  full semver dep is unnecessary (no new deps). Edge: pre-release "latest" tags — out of scope unless
  a future clarify adds them.

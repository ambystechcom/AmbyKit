---
feature: 036-core-and-plugin-targets
created: 2026-11-20
---

# Tests — Core targets and official plugin targets

> Test design, written by `/amby.tasks` before code. One case per acceptance criterion; machine-read by `ambykit analyze`.
> Case: `- [TC-###] [US-n#k] [FR-###, FR-###] auto — short name → expected outcome`
> Name tests in code `036:FR-###: …` (qualified). Core tests use a fixture plugin shaped like Antigravity; the package in `plugins/<name>/` is tested by the root vitest with the published contract kit, and the release scripts by `test/scripts/plugin-release.test.ts`.

## Cases

- [TC-001] [US-1#1] [FR-003] auto — moved target with its plugin installed and listed → files are what the plugin defines; the golden in `plugins/antigravity/test/` and the install test show byte-identity with 1.x
- [TC-002] [US-1#2] [FR-004] auto — moved target with no plugin → `sync`, `check` and `update` name the target and print the exact install and config lines
- [TC-003] [US-1#2] [FR-004] auto — moved target with no plugin and two other targets → the others still sync and the exit code is non-zero
- [TC-004] [US-1#3] [FR-005] auto — moved target with no plugin → no file it previously emitted is deleted or changed
- [TC-005] [US-1#4] [FR-001] auto — built-in target → behaviour unchanged by the move
- [TC-006] [US-2#1] [FR-007] auto — the plugin package → named `ambykit-emitter-*`, under the project scope, declaring its API range (`plugins/<name>/package.json`, checked by `verifyPackage` in `test/scripts/plugin-release.test.ts`)
- [TC-007] [US-2#2] [FR-007] auto — the published kit run → emitted paths, frontmatter keys and idempotence pass against the target's row (`plugins/antigravity/test/`)
- [TC-008] [US-2#3] [FR-008] auto — an upstream format fix for one moved target → only that package changes version (`parseTag` maps `plugin/<name>/v<x.y.z>` to one directory; `test/scripts/plugin-release.test.ts`)
- [TC-009] [US-2#1] [FR-007] manual:external-system — the Antigravity package on npm → install-tested on a 1.6-synced project, `sync` shows no diff; verify: T035; record: `research.md`
- [TC-010] [US-3#1] [FR-009] auto — the changelog and migration guide → list every moved id, its package and install line
- [TC-011] [US-3#2] [FR-006] auto — `update` with a moved target → offers the install and config change and writes nothing user-level without consent
- [TC-012] [US-3#3] [FR-010] auto — `init` and `add` → built-in targets listed; moved ones shown as "official plugin, install first" with the install line
- [TC-013] [US-4#1] [FR-001, FR-002] auto — the registry → holds exactly the eight built-in ids
- [TC-014] [US-4#2] [FR-011] auto — `docs/tool-compatibility.md` and the README → each target marked built in or official plugin with its package; doc-sync passes
- [TC-015] [US-4#3] [FR-012] auto — the core goldens → built-in ids only; the moved targets' goldens are checked by the plugin's contract run
- [TC-016] [US-1#2] [FR-002] auto — a long-tail target whose plugin is not published → stays built in and prints a deprecation notice naming the replacing package (C-4)
- [TC-017] [US-1#1] [FR-003] auto — `codex` plus a plugin target sharing `.agents/skills` → shared files kept; removing one owner leaves them (edge)
- [TC-018] [US-1#2] [FR-004] auto — plugin installed but not listed, or listed with a mismatched version → reported as in 027:FR-006 (edge)
- [TC-019] [US-1#2] [FR-004] auto — plugin installed but outdated for the stable API → `check` says so (edge)
- [TC-020] [US-3#2] [FR-006] auto — `update` offline or with no registry access → says so, changes nothing (edge)

## Uncovered

- FR-002 first half (Antigravity moved): proven by TC-013 after Phase 6; before the plugin is published it is a gate, not a test.

## Flags

- US-2#1: "published under the project's npm scope" cannot be checked offline; the first publish (T034), the trusted publisher (T037) and TC-009 cover it.

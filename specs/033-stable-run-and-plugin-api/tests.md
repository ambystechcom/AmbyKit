---
feature: 033-stable-run-and-plugin-api
created: 2026-11-20
---

# Tests — Stable run and plugin API

> Test design, written by `/amby.tasks` before code. One case per acceptance criterion; machine-read by `ambykit analyze`.
> Case: `- [TC-###] [US-n#k] [FR-###, FR-###] auto — short name → expected outcome`
> Name tests in code `033:FR-###: …` (qualified). Live verification and the dogfood are manual because only a person with a real install can run them.

## Cases

- [TC-001] [US-1#1] [FR-001, FR-013] auto — the `run` contract block → every listed flag, exit code, state path and directive item exists in the code
- [TC-002] [US-1#2] [FR-001, FR-013] auto — the plugin contract block → every listed export, descriptor field and kit export exists
- [TC-003] [US-1#3] [FR-002] auto — a name not in the document → changing it does not fail the contract test
- [TC-004] [US-1#4] [FR-003] auto — an added flag or export → contract test still passes; the document states additions are allowed in a minor release
- [TC-005] [US-1#1] [FR-013] auto — a listed flag is removed in a fixture → the contract test fails naming it (SC-004)
- [TC-006] [US-2#1] [FR-004] auto — a runner with `verified: true` → a record file exists per listed platform with version, invocation, prompt delivery, exit and usage
- [TC-007] [US-2#2] [FR-005] auto — a runner with no record → not runnable by default and the plan says it is unverified
- [TC-008] [US-2#3] [FR-004] auto — `verified: true` without a record → the record test fails
- [TC-009] [US-2#4] [FR-004] manual:external-system — a `.cmd` shim launched on a real Windows install → exits as recorded; verify: run T063 on Windows; record: `verification/claude-win32.md`
- [TC-010] [US-2#1] [FR-004] manual:external-system — each runner on a live install → invocation, prompt, exit and usage match the record; verify: T063 and T064; record: `verification/`
- [TC-011] [US-2#2] [FR-005] auto — platform not in `verifiedOn` → refused with the platform named (edge: verified on one OS only)
- [TC-012] [US-2#2] [FR-005] auto — detected version outside `verifiedRange` → reported unverified with the version (edge: assistant CLI updated)
- [TC-013] [US-3#1] [FR-006] manual:external-system — one fleet builds two dependent features with a verified runner → second starts after the first merges with no manual step; verify: T071; record: `dogfood.md`
- [TC-014] [US-3#2] [FR-006] auto — the dogfood record names fleet run id, runner, versions and result → the guard accepts it
- [TC-015] [US-3#3] [FR-006] auto — no dogfood record or a failed result → `RUN_STABILITY` stays `experimental` and the guard test fails if it is `stable`
- [TC-016] [US-4#1] [FR-007] auto — API version and exports → a 2.x version and no experimental marker in exports, docs or the changelog convention
- [TC-017] [US-4#2] [FR-008] auto — the kit → checks only the frozen surface (its exports equal the contract block)
- [TC-018] [US-4#3] [FR-008] auto — a change that would break an existing plugin → the contract test fails, so it is held for a major version
- [TC-019] [US-4#4] [FR-009] auto — a plugin written for the 1.x API → loaded with a one-line note, or refused naming the names it relied on
- [TC-020] [US-4#4] [FR-009] auto — a plugin that imported an internal name → the loader prints which name and what to change instead of an unrelated error (edge)
- [TC-021] [US-4#4] [FR-009] auto — a range that excludes 1.x and 2.x → refused naming the version it needs
- [TC-022] [US-5#1] [FR-010] auto — a deprecated name → documented as deprecated in a minor with the replacement before a major removes it
- [TC-023] [US-5#2] [FR-011] auto — a deprecated name is used twice in one run → the notice prints once, to stderr, and the command works
- [TC-024] [US-5#3] [FR-010] auto — the policy text → states the security-fix exception and the changelog requirement
- [TC-025] [US-5#2] [FR-011] auto — a name deprecated in 2.3 that a 2.0 plugin still uses → the plugin loads and the notice appears (edge)
- [TC-026] [US-6#1] [FR-012] auto — a run directory written by 1.6 → 2.0 resumes without repeating completed lanes
- [TC-027] [US-6#1] [FR-012] auto — a 1.6 run interrupted mid-merge → resume completes the merge or stops naming the conflict (edge)
- [TC-028] [US-6#2] [FR-009] auto — a plugin for the 1.0 API → loads, or reports exactly which names it relied on

## Uncovered

- FR-013 beyond the cases above: covered structurally by TC-001 and TC-002 (each listed promise has a check); no separate case.

## Flags

- US-2#4: needs a real Windows install; recorded as manual (TC-009), not automatable here.

---
feature: 008-codex-integration
created: 2026-07-13
---

# Tasks — Codex CLI integration

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Foundational  (blocks all feature work)

- [x] [T010] CodexEmitter: skills surface, `.agents/skills/<skill>/SKILL.md` path via skill-name helper (src/emitters/codex.ts)
- [x] [T011] CodexEmitter: `commandFrontmatter` → `name` + `description` only (src/emitters/codex.ts)
- [x] [T012] [P] Register `codex` target in the registry (src/emitters/index.ts)
- [x] [T013] [P] Add minimal `codex` mention to the compatibility page — required immediately, `check-docs-sync.test.ts` assertion A5 fails the instant a non-alias target is registered without it (site/src/content/docs/cli/compatibility.mdx)

## Phase 2 — User story US-1 — Select Codex as a target, get native phase commands  (priority: P1)

- [x] [T020] [US1] Snapshot test: `amby.specify` emits to `.agents/skills/amby-specify/SKILL.md` with `name`/`description` frontmatter (test/m3-emitters.test.ts)
- [x] [T021] [US1] Snapshot test: two consecutive `emit()` calls produce identical output (idempotent sync, FR-005) (test/m3-emitters.test.ts)
- **Checkpoint:** US-1 is demoable — selecting Codex in `init`/`add` produces skill files Codex can list and invoke.

## Phase 3 — User story US-2 — Codex honors shared rules without a bridge file  (priority: P1)

- [x] [T030] [US2] Test: `CodexEmitter.emit()` with `manageRules: true` emits no Codex-specific rules file, relying on the shared `AGENTS.md` (test/m3-emitters.test.ts)
- **Checkpoint:** US-2 is demoable — root `AGENTS.md` is the only rules file; no `CLAUDE.md`-style bridge exists for Codex.

## Phase 4 — User story US-3 — Phase arguments reach the prompt as trailing free text  (priority: P2)

- [x] [T040] [US3] CodexEmitter: `transformBody` rewrites `$ARGUMENTS`/`$N` placeholders into prose instructing the agent to use the trailing free text (src/emitters/codex.ts)
- [x] [T041] [US3] Test: no literal `$ARGUMENTS`/`$1` token survives in the emitted `SKILL.md` body (test/m3-emitters.test.ts)
- **Checkpoint:** US-3 is demoable — invoking a phase skill in Codex with trailing text fills the phase prompt, not a placeholder.

## Phase 5 — User story US-4 — AmbyKit dogfoods Codex on its own repo  (priority: P3)

- [x] [T050] [US4] Full `docs/tool-compatibility.md` matrix row for Codex — rules file, command surface, frontmatter, MCP (out of scope note) (docs/tool-compatibility.md)
- [x] [T051] [US4] Full "Where files land" row for Codex on the compatibility page (site/src/content/docs/cli/compatibility.mdx)
- [x] [T052] [US4] Add `codex` to this repo's own target list (.amby/config.json)
- [x] [T053] [US4] Run `ambykit sync`; commit this repo's own generated `.agents/skills/amby-*/SKILL.md` files (repo root)
- **Checkpoint:** US-4 is demoable — CI's docs-sync and "repo sync produces no diff" checks pass with Codex included.

## Phase 6 — Polish

- [x] [T090] `npm run typecheck && npm test` passes clean
- [x] [T091] Verify all ten targets end-to-end in a temp project (`init` + `check`), including `codex`

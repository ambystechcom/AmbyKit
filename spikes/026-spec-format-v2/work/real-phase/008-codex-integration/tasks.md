---
feature: 008-codex-integration
created: 2026-07-13
---

# Tasks — Codex CLI integration

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Foundational  (blocks all feature work)

- [x] [T010] CodexEmitter: skills surface, `.agents/skills/<skill>/SKILL.md` path via skill-name helper
- [x] [T011] CodexEmitter: `commandFrontmatter` → `name` + `description` only
- [x] [T012] [P] Register `codex` target in the registry
- [x] [T013] [P] Add minimal `codex` mention to the compatibility page — required immediately, `check-docs-sync.test.ts` assertion A5 fails the instant a non-alias target is registered without it

```yaml
files:
  T010: ["src/emitters/codex.ts"]
  T011: ["src/emitters/codex.ts"]
  T012: ["src/emitters/index.ts"]
  T013: ["site/src/content/docs/cli/compatibility.mdx"]
```

## Phase 2 — User story US-1 — Select Codex as a target, get native phase commands  (priority: P1)

- [x] [T020] [US1] Snapshot test: `amby.specify` emits to `.agents/skills/amby-specify/SKILL.md` with `name`/`description` frontmatter
- [x] [T021] [US1] Snapshot test: two consecutive `emit()` calls produce identical output (idempotent sync, FR-005)
- **Checkpoint:** US-1 is demoable — selecting Codex in `init`/`add` produces skill files Codex can list and invoke.

```yaml
files:
  T020: ["test/m3-emitters.test.ts"]
  T021: ["test/m3-emitters.test.ts"]
```

## Phase 3 — User story US-2 — Codex honors shared rules without a bridge file  (priority: P1)

- [x] [T030] [US2] Test: `CodexEmitter.emit()` with `manageRules: true` emits no Codex-specific rules file, relying on the shared `AGENTS.md`
- **Checkpoint:** US-2 is demoable — root `AGENTS.md` is the only rules file; no `CLAUDE.md`-style bridge exists for Codex.

```yaml
files:
  T030: ["test/m3-emitters.test.ts"]
```

## Phase 4 — User story US-3 — Phase arguments reach the prompt as trailing free text  (priority: P2)

- [x] [T040] [US3] CodexEmitter: `transformBody` rewrites `$ARGUMENTS`/`$N` placeholders into prose instructing the agent to use the trailing free text
- [x] [T041] [US3] Test: no literal `$ARGUMENTS`/`$1` token survives in the emitted `SKILL.md` body
- **Checkpoint:** US-3 is demoable — invoking a phase skill in Codex with trailing text fills the phase prompt, not a placeholder.

```yaml
files:
  T040: ["src/emitters/codex.ts"]
  T041: ["test/m3-emitters.test.ts"]
```

## Phase 5 — User story US-4 — AmbyKit dogfoods Codex on its own repo  (priority: P3)

- [x] [T050] [US4] Full `docs/tool-compatibility.md` matrix row for Codex — rules file, command surface, frontmatter, MCP (out of scope note)
- [x] [T051] [US4] Full "Where files land" row for Codex on the compatibility page
- [x] [T052] [US4] Add `codex` to this repo's own target list
- [x] [T053] [US4] Run `ambykit sync`; commit this repo's own generated `.agents/skills/amby-*/SKILL.md` files (repo root)
- **Checkpoint:** US-4 is demoable — CI's docs-sync and "repo sync produces no diff" checks pass with Codex included.

```yaml
files:
  T050: ["docs/tool-compatibility.md"]
  T051: ["site/src/content/docs/cli/compatibility.mdx"]
  T052: [".amby/config.json"]
```

## Phase 6 — Polish

- [x] [T090] `npm run typecheck && npm test` passes clean
- [x] [T091] Verify all ten targets end-to-end in a temp project (`init` + `check`), including `codex`

---
feature: 016-agent-surface-expansion
created: 2026-10-26
---

# Tasks — Agent surface expansion — eight new assistants, verified formats only

> Line format: `- [ ] [T###] [P?] [US#] description (file/path, other/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [ ] [T001] [P] Helper: emit one target into a temp project and return the path→contents map (test/helpers/emit-target.ts)
- [ ] [T002] Golden test: record every file of the ten existing targets, then assert byte-identical — FR-010, SC-004 (test/emitters-golden.test.ts, test/fixtures/emitters-golden/)

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T005] Extract `renderCommand(pairs, notice, body)` hook from commandFile; no output change (src/emitters/base-emitter.ts)
- [ ] [T006] `SkillsEmitter` abstract (skillName, SKILL.md path, name+description, `$ARGUMENTS`→prose) (src/emitters/skills-emitter.ts)
- [ ] [T007] Move Codex and Copilot CLI onto SkillsEmitter; golden test still green (src/emitters/codex.ts, src/emitters/copilot-cli.ts)
- [ ] [T008] Collision guard: same path + different contents throws naming both tool ids — FR-007 (src/core/emit.ts)
- [ ] [T009] [P] Guard tests: identical shared output written once; differing output throws (test/emit-collision.test.ts)

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T010] [US1] Matrix: eight new columns, sources, "Out of scope" (Amazon Q, Kiro prompts, persona files), live-verify list, `.agents/skills` overlap note — FR-001/002 (docs/tool-compatibility.md)
- [ ] [T011] [P] [US1] Verify CLI executable names from official install docs; record in research R9 (specs/016-agent-surface-expansion/research.md)
- [ ] [T012] [US1] docs-sync passes with the new matrix (scripts/check-docs-sync.mjs)
- **Checkpoint:** US-1 — every target has a sourced row; nothing is emitted yet.

## Phase 4 — User story US-3  (priority: P1)

- [ ] [T020] [US3] `TomlCommandEmitter`: `# notice`, basic-escaped description, literal `'''` prompt with `"""` fallback, `{{args}}` (src/emitters/toml-command-emitter.ts)
- [ ] [T021] [US3] GeminiEmitter: `.gemini/commands/amby.<phase>.toml` + GEMINI.md pointer region (src/emitters/gemini.ts)
- [ ] [T022] [US3] LlxprtEmitter: `.llxprt/commands/amby.<phase>.toml` + LLXPRT.md pointer region (src/emitters/llxprt.ts)
- [ ] [T023] [US3] Register gemini + llxprt targets (src/emitters/index.ts)
- [ ] [T024] [P] [US3] Tests: paths/keys per matrix, `{{args}}`, escaping (backslash, quotes, `'''` fallback), TOML round-trip parse in test only, prompts contain no `!{`/`@{` (test/toml-emitters.test.ts)
- [ ] [T025] [US3] Manual: load `/amby.specify` in a live Gemini CLI from emitted files; record result — SC-006 (specs/016-agent-surface-expansion/research.md)
- **Checkpoint:** US-3 — non-markdown commands are expressible; existing output unchanged.

## Phase 5 — User story US-2  (priority: P1)

- [ ] [T030] [P] [US2] QwenEmitter: `.qwen/commands/*.md`, description + argument-hint, `$ARGUMENTS`→`{{args}}` (src/emitters/qwen.ts)
- [ ] [T031] [P] [US2] KiloEmitter: `.kilo/commands/*.md`, description (src/emitters/kilo.ts)
- [ ] [T032] [P] [US2] AugmentEmitter: `.augment/commands/*.md`, description + argument-hint (src/emitters/augment.ts)
- [ ] [T033] [P] [US2] WindsurfEmitter: `.windsurf/workflows/*.md`, no frontmatter, `$ARGUMENTS`→prose (src/emitters/windsurf.ts)
- [ ] [T034] [US2] Register qwen, kilo, augment, windsurf targets (src/emitters/index.ts)
- [ ] [T035] [P] [US2] Tests per target: exact file set, keys and nothing else, no rules file (AGENTS.md native), Windsurf files ≤ 12,000 chars (test/markdown-emitters-016.test.ts)
- **Checkpoint:** US-2 — four markdown targets emit natively.

## Phase 6 — User story US-4  (priority: P2)

- [ ] [T040] [US4] KiroEmitter on SkillsEmitter: `.kiro/skills/amby-<phase>/SKILL.md` (src/emitters/kiro.ts)
- [ ] [T041] [US4] Pi target as alias of the Codex emitter; register kiro + pi (src/emitters/index.ts)
- [ ] [T042] [P] [US4] Tests: Kiro names match dirs (no dots); Pi alone = Codex files; Pi+Codex written once; dropping one keeps files (test/skills-emitters-016.test.ts)
- [ ] [T043] [US4] `ambykit check` lists owners of shared outputs (src/cli/check.ts)
- **Checkpoint:** US-4 — skill hosts reuse the skills surface.

## Phase 7 — User story US-5  (priority: P2)

- [ ] [T050] [US5] Selector viewport: scroll with cursor, ↑/↓ more hints, ASCII fallback — FR-013 (src/cli/ui/interactive/prompt.ts)
- [ ] [T051] [P] [US5] Selector tests: 18 options in 12 rows, every option reachable, hints correct (test/ui/prompt-viewport.test.ts)
- [ ] [T052] [P] [US5] AgentFamily + AGENTS entries for new ids (executables per T011) (src/core/agents.ts)
- [ ] [T053] [P] [US5] Glyph, ASCII tag and color per new family, AA contrast row (specs/017-live-dashboard/design-tokens.json, src/cli/ui/dashboard/live-tokens.ts)
- [ ] [T054] [P] [US5] `ambykit check` e2e per new target: present → clean; hand edit → drift — FR-012 (test/cli/check-targets.test.ts)
- [ ] [T055] [P] [US5] One-prompt-edit e2e: all 18 targets update via sync, `sync --check` clean — SC-005 (test/cli/sync-all-targets.test.ts)
- [ ] [T056] [P] [US5] Every new emitted file is `scope: "project"` — FR-008 (test/emit-scope.test.ts)
- **Checkpoint:** US-5 — eighteen targets with no extra maintenance cost.

## Phase 8 — Polish

- [ ] [T090] [P] README supported-assistants list (README.md)
- [ ] [T091] [P] CLI reference `--tools` ids and workflow guide target list (docs/cli-reference.md, docs/workflow.md)
- [ ] [T092] [P] Site compatibility page (site/src/content/docs/cli/compatibility.mdx)
- [ ] [T093] [P] CHANGELOG Unreleased entry (CHANGELOG.md)
- [ ] [T094] FR→test traceability; `npm run typecheck` + `npm test` + docs-sync — SC-007 (test/check-docs-sync.test.ts)

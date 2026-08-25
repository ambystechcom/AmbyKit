---
feature: 013-multi-agent-roles
created: 2026-08-25
---

# Tasks — Multi-agent roles — PM, Architect, QA perspectives in the workflow

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [x] [T001] After #7 merges: `ambykit worktree 013-multi-agent-roles` and work inside `.worktrees/013-multi-agent-roles/` (closes 012 T091 / SC-006) (.worktrees/)
- [x] [T002] [P] Phase 0 research: verify agent-file frontmatter for Claude Code, OpenCode, Copilot against official docs; record outcome per target (specs/013-multi-agent-roles/research.md)
- [x] [T003] [P] Add an "Agent frontmatter" row with the verified keys (or "unverified — not emitted") (docs/tool-compatibility.md)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Write six default roles ≤ 150 words each with `id`/`name`/`phases` frontmatter (src/roles/pm.md, ux.md, architect.md, tech-lead.md, developer.md, qa.md)
- [x] [T011] [P] `Role` type + `roles?: Role[]` on `RulesContext`; optional `role` on `CommandSpec` (src/core/types.ts)
- [x] [T012] [P] `loadRoles(root)`, `validateRoles(roles)` (duplicate ids case-insensitive → error; >150 words → warning), `wordCount` (src/core/roles.ts)
- [x] [T013] Accept optional `role: <id>` in prompt frontmatter schema (src/core/command-spec.ts)
- [x] [T014] Install `src/roles/*.md` into `.amby/roles/` write-if-absent alongside templates/reference; `rolesDir()` path helper (src/core/scaffold.ts, src/core/paths.ts)
- [x] [T015] Unit tests: loader parsing, duplicate refusal, word-count warning at 151, every shipped role ≤ 150 words (FR-010, SC-004) (test/core/roles.test.ts)
- [x] [T016] Export new module; `npm run typecheck && npm test` green (src/core/index.ts)

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Add `role:` to every phase prompt per the default mapping (pm/ux/architect/tech-lead/developer/qa) (src/prompts/*.md)
- [x] [T021] [US1] `BaseEmitter.transformBody`: when `ctx.roles` is non-empty and the spec has a role, prepend the role line (act-as + `--as` override + missing-file refusal) (src/emitters/base-emitter.ts)
- [x] [T022] [US1] `buildEmittedFiles`: load roles from the project root into `ctx.roles` (src/core/emit.ts)
- [x] [T023] [US1] Snapshot tests: with roles → line present on every command for every emitter; without `.amby/roles/` → output byte-identical to pre-feature (FR-003, FR-004, SC-001) (test/roles-emit.test.ts)
- **Checkpoint:** US-1 is demoable — emitted `/amby.specify` opens with "act as `@.amby/roles/pm.md`".

## Phase 4 — User story US-2  (priority: P1)

- [ ] [T030] [US2] `sync`: run `validateRoles` — print warnings, refuse (exit 1) on duplicate ids (src/cli/sync.ts)
- [ ] [T031] [US2] `check`: report role warnings/errors and any shipped default missing from `.amby/roles/` (src/cli/check.ts)
- [ ] [T032] [US2] `init`: roles installed with templates (via T014); confirm in the init summary line (src/cli/init.ts)
- [ ] [T033] [US2] E2E tests: edited role needs no command re-sync (`@path` load); duplicate → sync exit 1; 151-word role → exactly one warning; missing default reported by check (SC-003, SC-004) (test/cli/roles.test.ts)
- [ ] [T034] [US2] `ambykit sync` on this repo → `.amby/roles/` installed, commands regenerated; `ambykit check` clean (.amby/roles/, .claude/, .agents/)
- **Checkpoint:** US-2 is demoable — edit `.amby/roles/qa.md`, phases pick it up; sync/check validate.

## Phase 5 — User story US-4  (priority: P2, depends-on US-1)

- [ ] [T040] [US4] Finalize the `--as <id>` clause wording: use `@.amby/roles/<id>.md`; if missing, stop and list `.amby/roles/` (FR-005) (src/emitters/base-emitter.ts)
- [ ] [T041] [US4] Manual fixture: `/amby.plan --as qa` states "acting as QA"; `/amby.plan --as nope` refuses and lists roles (manual, scratchpad project)
- **Checkpoint:** US-4 is demoable — one-run override works and unknown roles are refused.

## Phase 6 — User story US-3  (priority: P2, depends-on US-1, US-2)

- [ ] [T050] [US3] Write the review phase: `/amby.review <artifact> [--as <role>] [--apply]` — findings `ID · severity · finding · fix`; read-only by default; `--apply` patches in place preserving IDs and appends a `## Reviews` record; zero findings → approval line (FR-006/007/008) (src/prompts/review.md)
- [ ] [T051] [P] [US3] Append `"review"` to `PHASE_SEQUENCE` after `converge` (src/core/rules.ts)
- [ ] [T052] [P] [US3] Emit test: loads as `amby.review`, `allowedTools: [read, edit]`, emitted by every command-surface emitter; update the phase-id list test (test/review-emit.test.ts, test/command-spec.test.ts)
- [ ] [T053] [P] [US3] Site page `order: 11` + LinkCard/Mermaid node/summary in the workflow overview (site/src/content/docs/workflow/review.mdx, index.mdx)
- [ ] [T054] [P] [US3] `/amby.review` in the README command list/table and `docs/workflow.md` phase table + section (README.md, docs/workflow.md)
- [ ] [T055] [US3] Manual fixture: flawed spec (untestable FR, missing negative case, unmeasurable SC) → QA review reports all three IDs; `--apply` preserves IDs and appends the record (SC-002) (manual, scratchpad project)
- [ ] [T056] [US3] Dogfood: run a QA review of this feature's spec and record it (SC-006) (specs/013-multi-agent-roles/spec.md)
- **Checkpoint:** US-3 is demoable — QA review of a spec yields ID-keyed findings; `--apply` records it.

## Phase 7 — User story US-5  (priority: P3, depends-on US-2)

- [ ] [T060] [US5] `BaseEmitter.roleFiles(roles, ctx)` default `[]`; called from `emit()` when `ctx.manageRules` (src/emitters/base-emitter.ts)
- [ ] [T061] [P] [US5] Override `roleFiles` for each target verified in T002 only (e.g. `.claude/agents/amby-<id>.md`), body = role body + pointer to `AGENTS.md` (src/emitters/claude.ts, opencode.ts, copilot.ts as verified)
- [ ] [T062] [P] [US5] Snapshot tests: one persona file per role for verified targets; none for cursor/antigravity/codex (FR-009) (test/roles-emit.test.ts)
- [ ] [T063] [US5] `ambykit sync` + `ambykit check` on this repo cover the persona files (.claude/agents/)
- **Checkpoint:** US-5 is demoable — verified targets get one native persona per role.

## Phase 8 — Polish

- [ ] [T090] [P] Workflow guide "Roles" section; CLI reference notes on `sync`/`check` role validation (docs/workflow.md, docs/cli-reference.md, site/src/content/docs/cli/index.mdx)
- [ ] [T091] [P] Tick 012's T091 now that this feature was developed in a worktree (specs/012-worktree-isolation/tasks.md)
- [ ] [T092] `node scripts/check-docs-sync.mjs`, site build, `npm run typecheck && npm test` all green (scripts/check-docs-sync.mjs)

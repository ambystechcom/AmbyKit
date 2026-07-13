---
feature: 008-codex-integration
status: draft
created: 2026-07-13
---

# Implementation Plan — Codex CLI integration

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.

## Technical context

- **Stack:** existing TypeScript/Node ESM codebase; no new runtime dependencies.
- **Key libraries:** none new — reuses `node:path/posix` and `BaseEmitter`'s existing YAML/frontmatter
  helpers, same as every other emitter.
- **Constraints driving choices:**
  - Principle 1/2 — new tool support must be a thin `BaseEmitter` subclass registered in
    `src/emitters/index.ts`; no orchestration duplication.
  - Principle 4 — every path/format below is sourced from `@spec.md`'s Background section (already
    verified against developers.openai.com/codex during `specify`); nothing here is guessed.
  - Principle 5 — needs a snapshot test (`test/m3-emitters.test.ts`, alongside the other
    surface-parity tests) and must keep `docs/tool-compatibility.md` +
    `site/src/content/docs/cli/compatibility.mdx` in sync (the latter is CI-enforced by
    `scripts/check-docs-sync.mjs` assertion A5, which fails the moment a non-alias target is added
    to the registry without a matching mention on the compatibility page).
  - Principle 7 — no user-level file writes; the skills mechanism is entirely project-scoped, so this
    is satisfied by construction (FR-004 has nothing to do).

## Architecture

One new class, `CodexEmitter extends BaseEmitter` (`src/emitters/codex.ts`), following the exact
shape of `AntigravityEmitter`/`OpenCodeEmitter` (AGENTS.md-native, no rules override) crossed with
`CopilotCliEmitter` (skills surface, nested `<skill>/SKILL.md` path):

- `commandSurface: "skills"`, `commandDir: ".agents/skills"`.
- `commandFilePath` override → `.agents/skills/<skill-name>/SKILL.md`, where `<skill-name>` is
  `spec.name` with `.` → `-` (e.g. `amby.specify` → `amby-specify`), same helper as
  `CopilotCliEmitter.skillName`.
- `commandFrontmatter` → `name` + `description` only (the only two keys Codex's `SKILL.md` documents;
  no `argument-hint` — Codex has no field for it).
- `transformBody` override → Codex skills have no `$ARGUMENTS`-style substitution (FR-003). Reusing
  the neutral body verbatim would leave a literal, un-substituted `$1`/`$ARGUMENTS` token in the
  rendered skill, which fails US-3's acceptance criteria. So the body's placeholder tokens are
  replaced with a short instruction phrase telling the agent to use the free text the user typed
  when invoking the skill — the same *kind* of fix `CopilotEmitter.transformBody` already applies for
  Copilot's `${input:…}` convention, just worded as prose instead of a substitution token since Codex
  skills have no substitution mechanism at all.
- No `rulesFiles` override (default: none) — Codex reads the shared root `AGENTS.md` natively, same
  as OpenCode/Cursor/Antigravity (FR-002, US-2). Nested-`AGENTS.md`/32 KiB behavior is intentionally
  left unhandled per spec's resolved edge case — no code, just a doc note.
- Register one target in `src/emitters/index.ts`: `{ id: "codex", displayName: "Codex CLI", emitter:
  codex }`. No VS Code-extension-style alias (unlike `claude`/`claude-vscode`) — the CLI and IDE
  extension share the same host config per spec's assumption, so one target covers both; the
  interactive picker in `src/ui/` already reads `TARGETS` dynamically, so no picker-copy changes are
  needed (confirmed: no per-tool strings exist outside the registry and the emitters).

No new entities, no new CLI verb, no new `AbstractTool`/`CommandSurface` value (`"skills"` already
exists), no data model or contracts artifacts — this is additive within the existing emitter
contract, so `data-model.md`/`contracts/` are not needed. Phase 0 research is already captured in
`@spec.md`'s Background section; no separate `research.md`.

## Phased approach

- **Phase 0 — Research:** done during `specify` (see `@spec.md` Background). Nothing further to do.
- **Phase 1 — Foundation:** add `CodexEmitter`, register the `codex` target, add the
  `m3-emitters.test.ts` case, and add the `codex` row to
  `site/src/content/docs/cli/compatibility.mdx` in the same change (required immediately —
  `check-docs-sync.test.ts` assertion A5 fails the instant a non-alias target is registered without
  it). This satisfies US-1/US-2 and FR-001/FR-002/FR-005/FR-007.
- **Phase 2 — Argument handling (US-3):** implement and test `transformBody`'s placeholder-to-prose
  rewrite; satisfies FR-003/FR-004.
- **Phase 3 — Docs + dogfood (US-4):** fill in the full `docs/tool-compatibility.md` matrix row
  (rules file, command surface, frontmatter — the compatibility.mdx line from Phase 1 only covers the
  minimum A5 needs) and the corresponding row on the compatibility page's "Where files land" table;
  add `codex` to this repo's own `.amby/config.json` `tools` list and run `ambykit sync` to generate
  this repo's own `.agents/skills/amby-*/SKILL.md` files (Principle 6). Satisfies FR-006.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `CodexEmitter` (skills surface, nested `SKILL.md` path) + `codex` entry in `TARGETS`. |
| FR-002 | No `rulesFiles` override — falls through to the shared root `AGENTS.md`, same as every other native-`AGENTS.md` tool. |
| FR-003 | `transformBody` rewrites the neutral placeholder to prose instructing the agent to use the trailing free text as the argument. |
| FR-004 | Satisfied by construction — the emitter never writes outside `.agents/skills/` (project scope); no MCP/user-level writing is implemented for Codex. |
| FR-005 | Inherited from `BaseEmitter.emit()`'s deterministic template method; verified with a snapshot test asserting stable output across two runs. |
| FR-006 | `docs/tool-compatibility.md` + `site/src/content/docs/cli/compatibility.mdx` gain a Codex row, sourced from `@spec.md` Background. |
| FR-007 | No code — documented as an intentional non-goal alongside the other `AGENTS.md`-native tools. |
| US-1 | Phase 1: `CodexEmitter` + `TARGETS` registration. |
| US-2 | Phase 1: default (no) `rulesFiles` override. |
| US-3 | Phase 2: `transformBody` override. |
| US-4 | Phase 3: docs updates + this repo's own `.amby/config.json` + `ambykit sync`. |

## Risks & decisions

- **Decision — one target, not two:** unlike `claude`/`claude-vscode`, Codex gets a single `codex`
  target covering both the CLI and IDE extension, per spec's assumption that they share host config.
  Risk: if a future Codex version diverges (e.g., IDE-only config), this needs revisiting — low risk,
  cheap to split later (same pattern as `antigravity`/`antigravity-cli`).
- **Decision — skills only, no fallback to custom prompts:** per spec's resolved FR-003, AmbyKit does
  not emit anything for Codex installs that predate skills. Risk: those users see no AmbyKit commands
  until they upgrade Codex — accepted per spec's edge-case resolution ("skills or nothing").
- **Risk — `transformBody`'s prose rewrite is a judgment call**, since Codex skills document no
  argument mechanism at all (unlike Copilot's `${input:…}`, which is a real substitution). Mitigate
  by keeping the rewritten phrase short and testing that no literal `$ARGUMENTS`/`$1` token survives
  in the emitted `SKILL.md` (Principle 5 — every FR maps to a test).
- **Risk — `check-docs-sync.test.ts` assertion A5** will fail the moment `codex` is added to
  `TARGETS` unless the compatibility page is updated in the same change. Sequenced as part of Phase 1
  (not deferred to Phase 3) to avoid a broken intermediate commit.

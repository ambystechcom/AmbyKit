---
feature: 013-multi-agent-roles
status: done
created: 2026-08-25
---

# Implementation Plan — Multi-agent roles — PM, Architect, QA perspectives in the workflow

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.

## Technical context

- **Stack:** existing TypeScript/ESM CLI, Vitest, Astro docs. No new dependencies (`gray-matter` +
  `zod` already parse frontmatter).
- **Key libraries:** none new.
- **Constraints driving choices:**
  - Principle 1 — roles are authored once as neutral Markdown (`src/roles/*.md` shipped, installed
    to `.amby/roles/`); every tool gets them through the existing emitters.
  - Principle 2 — role injection is one hook on `BaseEmitter`; native persona files are one
    overridable method; the review phase is one new `CommandSpec`. No per-tool prompt copies.
  - Principle 3 — a phase loads **one** role file (≤ 150 words, FR-010) via `@.amby/roles/<id>.md`;
    no role text is inlined into prompts or the rules region.
  - Principle 4 — native persona emission (US-5) only for formats verified in
    `docs/tool-compatibility.md`; Phase 0 verifies frontmatter keys, see `research.md`.
  - Principle 5 — loader unit tests, emitter snapshot tests, sync-warning test, docs-sync.
  - Principle 6/7 — `.amby/roles/` is project-owned (write-if-absent), in-tree only.

## Architecture

```
src/roles/{pm,ux,architect,tech-lead,developer,qa}.md   shipped defaults (≤150 words each)
        │ installArtifactTemplates() — write-if-absent (scaffold.ts)
        ▼
.amby/roles/<id>.md            project-owned role definitions        (US-2, FR-001)
        │ loadRoles(root) — src/core/roles.ts (parse, validate, word count)
        ▼
RulesContext.roles ──▶ BaseEmitter.transformBody(): prepends the role line   (US-1, US-4, FR-003/005)
                  └──▶ BaseEmitter.roleFiles(): native persona files, default []  (US-5, FR-009)
src/prompts/*.md   + frontmatter `role: <id>`   (default mapping, FR-002/003)
src/prompts/review.md   /amby.review <artifact> [--as <role>] [--apply]   (US-3, FR-006/007/008)
```

**Role file contract** (`.amby/roles/<id>.md`)

```yaml
---
id: qa                # kebab, unique case-insensitively
name: QA Engineer
phases: [analyze, converge]   # default mapping; informational for docs/check
---
<mission — 1–2 sentences>
**Focus:** <5–8 bullets the role checks on every artifact>
**Hand-off:** <what the next role must find in the artifact>
```

**Role line injected by emitters** (only when `.amby/roles/` exists at emit time, else nothing —
FR-004). Prepended to the command body, one sentence:

> Act as the role in `@.amby/roles/<role>.md` and say so in your first line. If `$ARGUMENTS`
> contains `--as <id>`, use `@.amby/roles/<id>.md` instead; if that file is missing, stop and list
> the files in `.amby/roles/`.

Because the line references the role by `@path`, editing a role file needs no re-sync of commands
(US-2 AC 2) — `sync` only matters for native persona files and the size warning.

**Review phase** (`src/prompts/review.md`, `allowedTools: [read, edit]`, `writes: []` by default):
read the named artifact + the reviewing role; output findings `ID · severity · finding · fix`;
with `--apply`, patch in place preserving IDs and append `- <date> <role>: <n> findings applied` (or
`approved`) under a `## Reviews` heading at the end of the artifact (FR-007/008). Advisory only.

**Size + validation** (`src/core/roles.ts`): `loadRoles(root)` → `{id, name, phases, body, words}`;
`validateRoles()` → errors for duplicate ids (case-insensitive) and warnings for `words > 150`.
`sync` prints warnings, refuses on errors; `check` reports both and also flags a shipped default
missing from `.amby/roles/` (edge case: deleted role → `sync` re-installs by write-if-absent).

**Native persona files (US-5)** — emitted by `roleFiles()` overrides **only after** `research.md`
confirms the frontmatter against official docs:

| Target | Path (compat matrix) | Status |
|---|---|---|
| Claude Code | `.claude/agents/amby-<id>.md` | verify keys in Phase 0 |
| OpenCode | `.opencode/agents/amby-<id>.md` | verify keys in Phase 0 |
| Copilot (VS Code + CLI) | `.github/agents/amby-<id>.agent.md` | verify keys in Phase 0 |
| Cursor, Antigravity, Codex | none | out of scope (matrix: no file format) |

Persona body = role body + one line pointing to `AGENTS.md` for the workflow. Covered by the same
`sync`/`check` drift detection as commands (FR-011).

## Phased approach

- **Phase 0 — Research** → `research.md`: verify agent-file frontmatter for Claude Code, OpenCode,
  Copilot from official docs; record verified keys in `docs/tool-compatibility.md` (new row "Agent
  frontmatter"). Any target that cannot be verified is dropped from US-5.
- **Phase 1 — Foundation:** `src/roles/*.md` (six defaults), `src/core/roles.ts` + tests,
  `RulesContext.roles`, `installArtifactTemplates` covers `roles/`, `CommandSpec.role` frontmatter
  key (optional). `data-model.md` not needed — the role contract above is the whole model.
- **Phase 2 — US-1 + US-2 (P1):** `role:` on every prompt; `BaseEmitter.transformBody` injection;
  `sync` size warning + duplicate refusal; `check` reporting; snapshot tests; `ambykit sync` on this
  repo (installs `.amby/roles/`).
- **Phase 3 — US-4 (P2):** `--as` handling is in the injected line; add the unknown-role refusal
  wording + a manual fixture check.
- **Phase 4 — US-3 (P2):** `src/prompts/review.md`, emit test, site page (`order: 11`), docs;
  dogfood: QA review of this spec (SC-006).
- **Phase 5 — US-5 (P3):** `roleFiles()` overrides for verified targets only; snapshot tests;
  compat-matrix row; `check` covers the files.
- **Phase 6 — Docs/polish:** workflow guide "Roles" section, CLI reference (`sync`/`check` notes),
  README; docs-sync green; 012's T091 ticked (this feature developed in `.worktrees/`).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `src/roles/*.md` → `.amby/roles/` via `installArtifactTemplates` (write-if-absent) |
| FR-002 | six shipped role files; `phases:` frontmatter; `role:` on each prompt |
| FR-003 | `role:` frontmatter + injected `@.amby/roles/<id>.md` line (one file loaded) |
| FR-004 | injection only when `.amby/roles/` exists; no roles → identical output (snapshot test) |
| FR-005 | `--as <id>` clause in the injected line; missing file → stop + list |
| FR-006 | `review.md` prompt, `writes: []`, findings keyed by ID |
| FR-007, FR-008 | `--apply` branch of `review.md`; `## Reviews` record; approval line on zero findings |
| FR-009 | `BaseEmitter.roleFiles()` default `[]`; overrides only for Phase-0-verified targets |
| FR-010 | shipped roles ≤ 150 words (test asserts); `validateRoles` warning at `sync` |
| FR-011 | role files in `buildEmittedFiles` → `check` drift; docs tasks + docs-sync |
| FR-012 | roles are prompt-level; nothing spawns processes; works per-assistant via `--as` |
| US-1, US-2 | Phase 2 |
| US-3 | Phase 4 |
| US-4 | Phase 3 |
| US-5 | Phase 5 |
| SC-001 | snapshot: emit with vs. without `.amby/roles/` differs only by the injected line |
| SC-002 | manual fixture: flawed spec → QA review lists the 3 seeded IDs |
| SC-003 | edit role → `@path` load needs no sync; persona file drift caught by `check` (test) |
| SC-004 | test: each `src/roles/*.md` ≤ 150 words; 151-word fixture → 1 warning |
| SC-005 | tests listed per phase; manual fixtures for model-executed behavior |
| SC-006 | Phase 4 dogfood + development in `.worktrees/013-multi-agent-roles` |

## Risks & decisions

- **Decision: roles referenced by `@path`, never inlined.** Keeps per-phase overhead to one ≤150-word
  file and makes role edits live without re-emitting commands (Principle 3, US-2).
- **Decision: injection lives in `BaseEmitter`, not in prompt bodies.** One hook serves all ten
  prompts and every tool (Principle 2); prompts only gain a `role:` key.
- **Decision: review is a phase prompt, not a CLI verb.** Reviewing needs the model; the CLI only
  validates/emits roles (zero tokens for `sync`/`check`).
- **Risk: native persona frontmatter is not yet in the compat matrix** (only paths are). Phase 0
  verifies against official docs; unverifiable targets are excluded, per FR-009 — US-5 may ship
  with fewer targets than listed.
- **Risk: the injected line changes every emitted command** once `.amby/roles/` exists → one-time
  `sync` diff for existing projects. Acceptable; `check` explains it.
- **Risk: `$ARGUMENTS --as` parsing is prose-level.** Tools pass arguments as a string; the model
  must honor the clause. Mitigated by a manual fixture (US-4) and explicit refusal wording.
- **Gap check:** no requirement in the spec is unsatisfiable; no `clarify` needed.

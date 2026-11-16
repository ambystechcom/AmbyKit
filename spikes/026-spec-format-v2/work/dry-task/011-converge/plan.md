---
feature: 011-converge
status: done
created: 2026-08-25
---

# Implementation Plan — Converge — post-implement gap check against spec, plan, tasks

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.

## Technical context

- **Stack:** existing TypeScript/ESM CLI (Node ≥ 20), Vitest, Astro docs site under `site/`.
- **Key libraries:** none new. `gray-matter` (already used) parses prompt frontmatter;
  `loadCommandSpecs()` in `src/core/command-spec.ts` is the only loader.
- **Constraints driving choices:**
  - Principle 1 — converge is **one neutral prompt** `src/prompts/converge.md`; every target gets it
    from existing emitters with zero emitter code.
  - Principle 3 — the prompt is assistant-run (reads code with model tokens) but must scope reads
    to the feature's artifacts and the files they name; the prompt body stays in the ~150-word
    band of `analyze.md` / `implement.md` (FR-014).
  - Principle 5 — a `test/converge-emit.test.ts` mirroring `test/revise-emit.test.ts`.
  - Principle 6 — after adding the prompt, run `ambykit sync` so `.claude/commands/amby.converge.md`
    and the repo's `AGENTS.md`/`CLAUDE.md` region are regenerated; docs-sync checker must pass.
  - Principle 7 — writes limited to the feature dir (`tasks.md`, `spec.md` status lines).

## Architecture

No new runtime component. Three touch points:

```
src/prompts/converge.md ──loadCommandSpecs()──▶ all emitters ──▶ .claude/commands/amby.converge.md,
                                                                  .github/prompts/…, etc.
src/core/rules.ts  PHASE_SEQUENCE += "converge" (after "implement")  → AGENTS.md phase list order
site/ + docs/ + README.md                        → docs-sync assertions A1/A2/A3/A6/A8
```

**Prompt contract (`converge.md` frontmatter)**

| key | value |
|---|---|
| `id` / `name` / `phase` | `converge` / `amby.converge` / `converge` |
| `argument-hint` | `"[feature id, defaults to current]"` (FR-015) |
| `reads` | `specs/NNN-slug/spec.md`, `plan.md`, `tasks.md` (FR-001; plan sub-artifacts are read on demand) |
| `writes` | `specs/NNN-slug/tasks.md`, `specs/NNN-slug/spec.md` (FR-006) |
| `allowedTools` | `[read, edit]` — no `write`/`bash`, enforcing "never edits code" structurally (FR-006) |

**Prompt body (numbered steps, mirroring `implement.md` style)**

1. Resolve feature from `$ARGUMENTS`; if `tasks.md` missing → stop, say "run `/amby.tasks`" (FR-011);
   if `plan.md` missing → proceed against spec+tasks and note it (FR-012).
2. For each `FR-###`/`SC-###`, plan decision, and checked `T###`: locate evidence in the files the
   plan/tasks name; classify **covered / gap / unverified** (FR-002, FR-003, FR-013). Items the plan
   marks deferred/out-of-scope are skipped.
3. Append under `## Convergence` in `tasks.md`: one `- [ ] T### …(closes FR-…)` per gap and one
   `- [ ] T### [VERIFY] …` per unverified item; IDs continue from the highest `T###` anywhere in the
   file; skip any that already exist unchecked in that section (FR-004, FR-007, FR-013). If nothing
   to append, do not touch the file (FR-005).
4. Patch `status:` lines only: story → `done` when all its FR/SC are covered; feature → `done` when
   all stories are (FR-009).
5. Print: verdict (**converged** / **gaps found (N)**), counts, per-ID table with one-line reasons
   (FR-008).

## Phased approach

- **Phase 0 — Research:** none needed; pattern is identical to feature 009 (`revise`). No
  `research.md`.
- **Phase 1 — Foundation:** `src/prompts/converge.md` + `PHASE_SEQUENCE` entry + emit test. No
  `data-model.md`/`contracts/` — the only "contract" is the frontmatter table above.
- **Phase 2 — US-1/US-2 (P1):** prompt body steps 1–3 and 5; emit test asserting id/name/phase/
  allowedTools and presence in every command-surface emitter output (SC-004).
- **Phase 3 — US-3 (P2):** step 4 status patching. Dogfood on spec `001` (SC-005): run
  `/amby.converge 001-core-and-claude-emitter`, expect **converged** and `status: done`.
- **Phase 4 — US-4 (P2):** `ambykit sync` on the repo; commit regenerated tool files; `ambykit check`
  clean.
- **Phase 5 — US-5 (P3):** docs — `site/src/content/docs/workflow/converge.mdx` (frontmatter
  `phase/command/reads/writes/order` = 10), LinkCard + Mermaid node `implement ⇄ converge` + a11y
  summary in `workflow/index.mdx`, rows in `docs/workflow.md` and README workflow table/list,
  `docs/getting-started.md` loop mention. `npm run check:docs` (script `check-docs-sync.mjs`) passes.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-015 | frontmatter `reads` + `argument-hint`; body step 1 |
| FR-002, FR-003 | body step 2 classification |
| FR-004, FR-005, FR-007 | body step 3 append rules; `allowedTools: [read, edit]` |
| FR-006 | `writes` limited to `tasks.md`/`spec.md`; no `write`/`bash` tool; test asserts `allowedTools` |
| FR-008 | body step 5 output format |
| FR-009 | body step 4 |
| FR-010 | single neutral prompt; emit test over Claude/Cursor/Copilot emitters |
| FR-011, FR-012 | body step 1 guards |
| FR-013 | `[VERIFY]` tasks in step 3 |
| FR-014 | prompt body ≤ ~180 words; reviewed at PR, not test-asserted |
| US-1, US-2 | Phase 2 |
| US-3 | Phase 3 |
| US-4 | Phase 4 |
| US-5 | Phase 5 |
| SC-001, SC-002 | Prompt semantics — validated manually via a seeded fixture feature in a scratch project (see Risks) |
| SC-003 | structural: no `write`/`bash` tools |
| SC-004 | `test/converge-emit.test.ts` |
| SC-005 | Phase 3 dogfood run |

## Risks & decisions

- **Decision: prompt-only, no CLI verb.** A local zero-token `ambykit converge` would need code
  understanding the CLI cannot do; the spec's assumption already scopes this out. `analyze`/
  `dashboard` need no change because appended tasks use the existing `- [ ] T###` shape.
- **Decision: `allowedTools: [read, edit]`.** Structurally forbids code edits and shell (FR-006,
  SC-003) instead of relying on prose. `edit` suffices since `tasks.md` always exists (FR-011) and
  `## Convergence` is added via edit-append.
- **Decision: phase order `implement → converge` (last).** Placed after `implement` in
  `PHASE_SEQUENCE` and as `order: 10` in the site; `revise` stays at its current slot.
- **Risk: SC-001/SC-002 are behavioral (model-executed) and cannot be unit-tested.** Mitigation:
  a manual fixture checklist in `tasks.md`; the emit test covers everything mechanical. Flagged, not
  a spec gap.
- **Risk: ID continuation when the highest `T###` sits inside `## Convergence`.** The prompt says
  "highest anywhere in the file", covering the edge case explicitly.
- **Risk: docs-sync A3 contiguity.** Adding page `order: 10` requires no renumbering only if
  current pages are 1..9 — verify during Phase 5.

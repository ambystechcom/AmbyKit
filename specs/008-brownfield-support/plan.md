---
feature: 008-brownfield-support
status: draft
created: 2026-07-20
---

# Implementation Plan — Brownfield project support (non-destructive init & doc update)

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> References spec by ID — does not restate it. No `ui.md` (CLI-only feature).

## Technical context

- **Stack:** existing AmbyKit CLI — Node ≥ 20, TypeScript (ESM, NodeNext), Vitest. No new runtime deps.
- **Key libraries:** Node stdlib only (`node:fs`, `node:path`, `node:child_process` for git probe).
  Reuse existing `BaseCommand`/`BaseEmitter`/`applyFiles` machinery (Principle 2).
- **Constraints driving choices:**
  - Principle 1 — the AmbyKit region is authored **once** as a neutral string; emitters wrap it per
    tool. No hand-authored per-tool rules.
  - Principle 2 — the merge is a new `src/core` module + a single change to the shared writer, not
    per-command logic. No new CLI verb (init/sync already route through `applyFiles`).
  - Principle 3 — patch the region in place; never rewrite non-AmbyKit bytes.
  - Principle 4 — per-tool rules paths/format still come from the emitters / compatibility matrix.
  - Principle 6 — `check`/CI must stay green after a brownfield run (idempotent, byte-stable writes).
  - Principle 7 — non-destructive by default, timestamped backups, no user-scope writes without consent.

## Root cause (today)

Rules files (`AGENTS.md`, per-tool `CLAUDE.md` bridge, etc.) are emitted as **whole-file**
`EmittedFile.contents` (`src/cli/emit.ts`, `src/core/rules.ts`, `src/emitters/claude.ts`) and written
by `applyFiles` (`src/cli/fsops.ts:36-57`), which overwrites unconditionally. That is the greenfield
assumption and the source of the data loss the spec reports.

## Architecture

Introduce a **merge strategy** on emitted files and a pure region-merge core; make the shared writer
strategy-aware. Everything flows through the existing `buildEmittedFiles → applyFiles` pipeline, so
`init`, `sync`, and `check` all gain brownfield behavior at once.

```
                 authored once (neutral)
  buildAmbyRegion() ── "### AmbyKit usage …"  ─┐   Principle 1/3
                                               │
  emitters (claude/agents/…) wrap region ──────┤   FR-006, FR-011
        into EmittedFile{ merge: "region" }    │
                                               ▼
  buildEmittedFiles() ──▶ applyFiles() ──▶ per file:
                                   ├ merge==="overwrite" → today's behavior (commands, amby.* )
                                   └ merge==="region"    → mergeRules() [src/core/merge.ts]
                                                            ├ parse region bounds  (FR-003)
                                                            ├ file absent → whole greenfield file (FR-002)
                                                            ├ region present → splice in place (FR-004)
                                                            ├ fingerprint mismatch → skip+report (FR-008a)
                                                            ├ unreadable/malformed → abort file (FR-007)
                                                            └ before write → backup (FR-008c)

  classifyProject(root) ──▶ "brownfield" | "greenfield"  (FR-008/009) — reporting + safe default
```

### New / changed units

- **`src/core/merge.ts` (new, pure):** the heart. `findRegion(text)` locates the `### AmbyKit usage`
  H3 up to the next same-or-higher heading or EOF (FR-003). `mergeRegion(existing, region)` returns
  `{ contents, action: "created"|"updated"|"unchanged"|"skipped", reason? }`. Skip-detection compares
  a fingerprint embedded in the region footer against the current region body (FR-008a). Pure,
  unit-testable, side-effect free (keeps fs at the edges — Conventions).
- **`src/core/classify.ts` (new, pure-ish):** `classifyProject(root)` → `{ mode, signals }` using
  rules-file presence, non-AmbyKit source files, and git-history probe (FR-008). Ambiguous → brownfield.
- **`EmittedFile.merge?: "overwrite" | "region"`** (default `"overwrite"`) in `core/types.ts`.
  Region content also carries the region marker/fingerprint so the writer needs no extra state.
- **`src/cli/fsops.ts`:** `applyFiles` branches on `file.merge`. Region files: read existing, call
  `mergeRegion`, write backup then merged contents; per-file `try/catch` → abort just that file and
  record the reason (FR-007). New `WriteResult` buckets: `skipped` reasons surfaced, backups tracked.
- **Emitters (`rules.ts`, `claude.ts`, others):** move the AmbyKit body into the shared
  `buildAmbyRegion(ctx)` string starting `### AmbyKit usage`; emit it as `merge: "region"`. Claude
  additionally ensures the `@AGENTS.md` bridge import at file top on merge (FR-011).
- **`src/cli/init.ts`:** call `classifyProject`, print detected mode; pass through unchanged otherwise.
- **`check.ts`/`sync.ts`:** no logic change — they inherit merge-aware `applyFiles`. Backups written
  under `.amby/backups/` and excluded from the sync/check set (FR-010, Principle 7).

## Phased approach

- **Phase 0 — Research** → `research.md`: (a) skip-detection state — embedded fingerprint vs external
  manifest; (b) git-history probe without a new dep; (c) greenfield snapshot churn from the region
  marker change; (d) newline/encoding normalization for byte-stable idempotency.
- **Phase 1 — Foundation** → `data-model.md`, `contracts/merge.md`: entities (RulesRegion, MergePlan,
  ProjectClassification, Backup) and the pure signatures for `merge.ts` + `classify.ts`. Add
  `EmittedFile.merge` to `core/types.ts`.
- **Phase 2 — US-1 (P1):** `merge.ts` region parse + splice; `applyFiles` region branch + backups;
  emitters emit region. Non-destructive init proven. (FR-001,002,003,004,007,008c,011,012)
- **Phase 3 — US-2 (P1):** idempotent re-run + fingerprint skip-and-report; confirm `sync` is the
  update path (FR-005) and multi-tool fan-out (FR-006); `check` stays green (FR-010).
- **Phase 4 — US-3 (P2):** `classify.ts` + init reporting; ambiguous→brownfield default (FR-008,009).
- **Phase 5 — US-4 (P3):** backup restore surface + `--dry-run` region preview (FR-008b,008c; SC-005).
- **Phase 6 — US-5 (P2, docs):** update `docs/` + `README.md` and the `site/` dev-site mirror to
  cover brownfield behavior; assert cross-surface consistency (FR-013,014,015; SC-006). Hand-authored
  Markdown/MDX — not emitter-generated; `docs/` and `site/src/content/docs/` are parallel surfaces.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `mergeRegion` replaces only the region span; all other bytes copied verbatim |
| FR-002 | File-absent branch writes the full greenfield file (region ± wrapper); existing path preserved |
| FR-003 | `findRegion` parses `### AmbyKit usage` → next same/higher heading or EOF |
| FR-004 | Region present → in-place splice; never appends a second region (idempotent) |
| FR-005 | `ambykit sync` (region-aware) is the update path — no full re-init, no new verb |
| FR-006 | Each emitter emits its native rules file as `merge:"region"`; matrix-driven (Principle 4) |
| FR-007 | Per-file `try/catch` in `applyFiles`; abort that file, no partial write, record reason |
| FR-008 | `classifyProject` — rules file OR non-AmbyKit source OR git history; reports mode |
| FR-008a | Fingerprint of last-written region vs current body → mismatch = skip + report |
| FR-008b | `--dry-run` computes merged contents and reports intended change without writing |
| FR-008c | Backup to `.amby/backups/<file>.<ts>.bak` before any modify |
| FR-009 | Classifier default and merge-path default are the non-destructive branch |
| FR-010 | Byte-stable region writes → `check` unchanged; backups excluded from emitted set |
| FR-011 | Claude emitter ensures `@AGENTS.md` import at top when merging |
| FR-012 | Existing `includeUser=false` gate on user-scope files retained |
| FR-013 | Update `docs/` (getting-started, cli-reference, architecture) + `README.md` |
| FR-014 | Update `site/src/content/docs/` mirrors (start, cli, concepts) |
| FR-015 | Cross-surface consistency check between `docs/` and `site/` |
| US-1..US-5 | Phases 2–6 respectively; each independently testable per its spec block |

## Risks & decisions

- **Greenfield output changes shape** (adopting `### AmbyKit usage` alters today's `AGENTS.md`/
  `CLAUDE.md` bytes). Existing emitter snapshot tests **will be updated** to the region layout. The
  Assumption "existing tests must still pass" holds *semantically* (a fresh project still gets a
  complete, working rules file) but **not** byte-for-byte. → If byte-identity is actually required,
  run `/amby.clarify`; otherwise treat snapshot updates as expected (recorded in `research.md`).
- **Skip-detection state (FR-008a):** decision — embed a fingerprint comment in the region footer
  (self-contained, no external manifest, survives file moves). Rationale in `research.md`.
- **"Non-AmbyKit source files" is heuristic** (FR-008) — misclassification only ever biases toward the
  safe/non-destructive path (FR-009), so low risk.
- **Idempotency vs newlines/encoding** (spec edge cases): normalize line endings and trailing newline
  in the region writer so `check` doesn't flap. Non-UTF-8/read-only/symlink targets → FR-007 abort.
- **git-history probe:** prefer inspecting `.git` / a lightweight `git rev-parse` over adding a
  dependency (Principle 2, no new deps); confirm in Phase 0.

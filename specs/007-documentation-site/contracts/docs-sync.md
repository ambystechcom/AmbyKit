---
feature: 007-documentation-site
kind: contract
created: 2026-07-07
---

# Contract — docs-sync drift check (FR-014)

`scripts/check-docs-sync.mjs` — a Node script run in CI (and locally) that fails with a non-zero exit
when the site's workflow/command **facts** diverge from the AmbyKit source of truth. Prose is not
checked; the machine-checkable invariants below are. Honors Principle 1 + Principle 6.

## Inputs (source of truth)

- **Phases:** the neutral CommandSpecs under `src/prompts/*` (via the existing loader) — each has
  `id`, `name` (e.g. `amby.specify`), `reads`, `writes`.
- **CLI verbs:** the command registry in `src/cli` (`init`, `add`, `sync`, `dashboard`, `analyze`,
  `check`, `upgrade`).
- **Targets:** the emitter registry `TARGETS` in `src/emitters/index.ts`.

## Site facts (checked side)

Each phase page (`site/src/content/docs/workflow/<phase>.mdx`) declares frontmatter:

| Field | Type | Must match |
|---|---|---|
| `phase` | string | a CommandSpec `id` |
| `order` | number | its position in the workflow sequence |
| `command` | string | the CommandSpec `name` (e.g. `amby.specify`) |
| `reads` | string[] | the CommandSpec `reads` |
| `writes` | string[] | the CommandSpec `writes` |

The CLI-reference page(s) list every verb; the compatibility page lists every non-alias target id.

## Assertions (each failure is fatal)

- **A1** Every CommandSpec `id` has exactly one phase page; no page references an unknown `id`.
- **A2** For each phase page, `command`/`reads`/`writes` equal the CommandSpec's — no drift.
- **A3** `order` values are a contiguous 1..N sequence with no gaps/dupes.
- **A4** The CLI-reference lists every registry verb (no missing/extra).
- **A5** The compatibility page lists every non-alias `TARGETS` id and its command surface.

## Output

- Exit `0` and a one-line "docs in sync (N phases, M verbs, K targets)" on success.
- Exit `1` with a per-assertion diff (expected vs found) on failure — wired into `site.yml` before
  build, so drift blocks deploy.

## Test hooks (Principle 5)

- Fixture spec/page sets exercising each of A1–A5 (missing page, mismatched `reads`, gap in `order`,
  missing verb, missing target) → the check reports that assertion and exits non-zero.
- A "happy path" fixture where site facts match source → exit 0.

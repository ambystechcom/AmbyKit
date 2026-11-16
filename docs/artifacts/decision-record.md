# Artifact: decision records (`.amby/decisions/ADR-###.md`)

A **decision record** captures one decision that outlives a feature: the context, what was decided, the
alternatives rejected and the consequences. Written by `/amby.decide`, cited anywhere as `ADR-###`, and
checked by `ambykit analyze` at zero model tokens. Nothing is created at `init`; the folder appears with the
first decision, and a project that never records one sees no change.

## Files

- `.amby/decisions/ADR-###.md`, one record per file. The file name is the id with no slug, so two branches
  that take the same number collide in git (an add/add conflict) instead of silently coexisting. The title lives
  in the frontmatter.
- `.amby/decisions/README.md`, the index: one row per record, `| ADR-### | title | status |`. The prompt patches
  it in place. A row whose file was deleted stays as a tombstone, so a number is never reused.
- `.amby/templates/adr.md`, the template (installed write-if-absent, so you can customize it).

## Format

```
---
id: ADR-004
title: Store the fleet state as files
status: accepted          # proposed | accepted | superseded | deprecated
date: 2026-11-16
feature: 025-mcp-server   # optional
principle: 3              # optional: constitution principle it relates to
conflicts: []             # principle numbers it conflicts with; must be empty to accept
supersedes: ADR-002       # optional
superseded-by:            # set on the OLD record when replaced
---
## Context / ## Decision / ## Alternatives / ## Consequences
```

- **Number** = highest of the record files and the index rows, plus one, three digits.
- **Conflict**: a decision that conflicts with a constitution principle is written `proposed` with `conflicts`
  filled, and a person decides. `accepted` with a non-empty `conflicts` is an error.
- **Supersede**: `/amby.decide --supersede ADR-###` sets `supersedes` on the new record and `status: superseded`
  plus `superseded-by` on the old one. Both sides must agree. The old record's body is never edited.
- **Wording-only edits** keep the `id` and `status`.
- **Citing**: write `ADR-###` in specs, plans, the constitution or other records. Assistants load only the cited
  records plus the index, never the whole folder.

## Checks

`ambykit analyze` adds a `decisions` section (text and `--json`) only when records or citations exist.
Errors (exit status 1): `duplicate-id`, `dangling-citation` (a cited `ADR-###` with no record, found in
`specs/**/*.md`, the constitution and the records), `supersede-mismatch`, `supersede-cycle`,
`accepted-with-conflict`, `invalid-record`. Warning: `index-drift` (a record missing from the index).

## Security reviewer role

`ambykit init` installs a seventh read-only role, `.amby/roles/security.md`, used as
`/amby.review <artifact> --as security`. It reports findings by stable ID with a severity and a fix. It never
edits and never creates a record; where a choice is durable it suggests running `/amby.decide`.

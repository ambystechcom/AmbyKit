---
id: decide
name: amby.decide
description: Record a decision as a numbered record — cited by ID, supersedable, checked by analyze.
argument-hint: "<decision text> [--supersede ADR-###]"
phase: decide
reads: [.amby/decisions/README.md, .amby/templates/adr.md, .amby/constitution.md]
writes: [.amby/decisions/ADR-###.md, .amby/decisions/README.md]
allowedTools: [read, write, edit, bash]
---

Record the decision in `$ARGUMENTS`. Callable from any phase; it has no role of its own.

If a current feature applies, run `ambykit activity <feature> --agent=$AGENT --phase=decide` first; ignore any error.

1. No decision text → ask for it in one question. Read `.amby/decisions/README.md` (the index) only;
   if a row's title already covers the decision, name that `ADR-###` and stop — do not duplicate.
2. Number: highest of the `ADR-###.md` files **and** the index rows, plus 1, three digits. Never reuse a
   number, even for a deleted file. Create `.amby/decisions/` and its index (`| ID | Title | Status |`)
   on first use.
3. Write `.amby/decisions/ADR-<n>.md` from `@.amby/templates/adr.md`: Context, Decision, Alternatives,
   Consequences, each short. Fill `feature` from the current feature and `principle` when relevant.
   The file name is the id, with no slug.
4. Principle conflict: if the decision conflicts with a constitution principle, set `status: proposed`,
   list the principle numbers in `conflicts`, and tell the person it needs their call. Never write
   `accepted` with `conflicts` filled. Otherwise `status: accepted`.
5. `--supersede ADR-###`: set `supersedes` on the new record, and on the old record set
   `status: superseded` and `superseded-by: <new id>`. Both sides, always. Never edit the old record's body.
6. A wording-only edit of an existing record keeps its `id` and `status`.
7. Patch the index in place: add or update this record's row. Leave rows of deleted files (tombstones).
8. Cite decisions elsewhere only by `ADR-###`; never restate them. End with the id and path.

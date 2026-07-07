---
id: clarify
name: amby.clarify
description: Resolve the open [NEEDS CLARIFICATION] markers in a feature spec.
argument-hint: "[feature id, defaults to current]"
phase: clarify
reads: [specs/NNN-slug/spec.md]
writes: [specs/NNN-slug/spec.md]
allowedTools: [read, edit]
---

Resolve open questions in the spec for feature `$ARGUMENTS` (default: the current feature).

1. Read only that `spec.md`. Find every `[NEEDS CLARIFICATION: …]` marker.
2. For each, ask the user one concise, specific question. Offer a sensible default when one exists.
3. **Edit only the affected line(s)** — replace the marker with the resolved wording. Do not rewrite
   the rest of the file (token-frugal, non-destructive).
4. If an answer changes a requirement's testability, adjust just that `FR-###` or acceptance line.
5. When no markers remain, set the spec `status: ready` and report a one-line summary.

Do not add scope. If the user raises new scope, note it as a new `US-#` rather than expanding others.

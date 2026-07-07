---
id: constitution
name: amby.constitution
description: Create or amend the project constitution — durable, cross-feature principles.
argument-hint: "[area to add or change, optional]"
phase: constitution
reads: []
writes: [.amby/constitution.md]
allowedTools: [read, write, edit]
---

Establish or update the project **constitution** at `.amby/constitution.md`.

1. If the file is missing, copy the constitution template and fill it in. If it exists, amend only
   the section relevant to `$ARGUMENTS` (or, with no argument, review all principles briefly).
2. Interview the user only where a principle is unclear — ask one focused question at a time.
3. Keep each principle short, imperative, and **numbered** so later phases can cite it.
4. Cover: code quality, testing standards, UX consistency, performance/reliability, security. Add
   project-specific non-negotiables as needed.
5. Bump the version and update the date. Do not restate feature requirements — those belong in specs.

Output only the edited constitution. Be concise.

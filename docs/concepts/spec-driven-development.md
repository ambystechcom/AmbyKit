# Spec-Driven Development

Spec-Driven Development (SDD) means the **specification is the primary artifact**, and code is
generated to satisfy it — not the other way around. With AI assistants, this matters more, not less:
an assistant is only as good as the requirements it's given, and a vague prompt yields plausible but
wrong software.

## Principles

1. **Separate WHAT from HOW.** The spec describes behavior and value with no technology decisions.
   The plan describes the technical approach. Mixing them produces specs that can't be reviewed by
   non-engineers and plans that re-litigate requirements.
2. **Make requirements testable.** Every requirement should map to a test. AmbyKit uses
   [EARS](https://alistairmavin.com/ears/) notation (WHEN/WHILE/IF … THE SYSTEM SHALL …) plus
   Given/When/Then acceptance criteria so requirements are unambiguous and traceable.
3. **Surface ambiguity, don't paper over it.** Unknowns become explicit `[NEEDS CLARIFICATION]`
   markers that a dedicated phase resolves — the assistant never silently guesses.
4. **Independent, prioritized stories.** Each user story is independently testable and carries a
   priority, so an MVP is a subset of stories, and work can be ordered and parallelized.
5. **Durable governance.** A project [constitution](./constitution.md) holds cross-feature principles
   that every phase must honor.

## Why "author once, emit per tool"

Teams use different assistants, and each reads a different config format. Writing the workflow once
and compiling it to every tool keeps a single source of truth and lets specs travel with the team.
See [architecture](../architecture.md).

## How AmbyKit compares

AmbyKit draws on proven prior art — GitHub Spec-Kit's phase model and templates, Kiro's
requirements/design/tasks split and EARS usage, and the [AGENTS.md](https://agents.md) standard for
neutral instructions — and adds a **first-class UI design artifact** and a **cross-tool emitter**
model on top.

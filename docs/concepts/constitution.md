# The constitution

The **constitution** (`.amby/constitution.md`) holds your project's non-negotiable, cross-feature
principles. It is written once with `/amby.constitution`, revised rarely, and referenced by every
later phase — the assistant must adhere to it when specifying, designing, planning, and implementing.

Think of it as durable guardrails, distinct from per-feature specs: specs change constantly, the
constitution almost never does.

## What belongs in it

- **Code quality** — style, structure, review bars, "don't touch" boundaries.
- **Testing standards** — required coverage, test-first expectations, what "done" means.
- **UX consistency** — design principles, accessibility requirements, tone.
- **Performance & reliability** — budgets and SLAs the system must meet.
- **Security & compliance** — constraints that override convenience.
- **Architectural constraints** — patterns to follow, technologies to prefer or avoid.

## What does not belong in it

- Feature requirements (those go in `spec.md`).
- Technology choices for a specific feature (those go in `plan.md`).
- Anything that changes per feature.

## Format

Plain Markdown with numbered, named principles so they can be cited (e.g. "per Principle 3, tests
precede implementation"). Keep each principle short and imperative. AmbyKit ships a starter template;
`/amby.constitution` fills it in through a short interview and can amend it later.

## Relationship to AGENTS.md

The constitution is *project governance for the SDD workflow*. `AGENTS.md` is *general repo context*
for the assistant (build commands, conventions). They complement each other; AmbyKit keeps them
separate so each stays focused.

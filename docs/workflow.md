# The AmbyKit workflow

Nine phases, each a slash command in your assistant, each producing or updating one artifact. The
happy path is **specify → design → plan → tasks → implement**, with `constitution` once up front and
`clarify`/`revise`/`analyze` when you need them.

| Phase | Command | Reads | Writes |
|---|---|---|---|
| Governance (once) | `/amby.constitution` | — | `.amby/constitution.md` |
| Specify (WHAT/WHY) | `/amby.specify` | constitution | `specs/NNN/spec.md` |
| Clarify | `/amby.clarify` | spec | spec (resolves markers) |
| Revise | `/amby.revise` | spec, ui | spec / ui (continues in place) |
| Design (UI) | `/amby.design` | spec | `ui.md`, `design-tokens.json` |
| Plan (HOW) | `/amby.plan` | spec, ui | `plan.md` (+ `data-model.md`, `contracts/`) |
| Tasks | `/amby.tasks` | plan | `tasks.md` |
| Analyze | `/amby.analyze` | all | consistency report |
| Implement | `/amby.implement` | tasks (one slice) | code + task/status updates |

## 1. Constitution

Durable, project-wide principles that constrain every feature. Written once, revised rarely. See
[the constitution](./concepts/constitution.md).

## 2. Specify — the WHAT and WHY

Describe the feature in business terms. The spec contains **no technology choices**. It defines user
stories with priorities, EARS functional requirements, Given/When/Then acceptance criteria, and
measurable success criteria. Unknowns become `[NEEDS CLARIFICATION: …]` markers rather than
guesses. See [the spec artifact](./artifacts/spec.md).

## 3. Clarify

Walks the open `[NEEDS CLARIFICATION]` markers, asks you targeted questions, and edits **only** those
lines — cheap and non-destructive.

## 4. Revise

Continues an existing feature: adds new user stories, requirements, and success criteria and refines
existing ones **in place**, preserving every stable ID. Distinct from `specify` (new feature) and
`clarify` (markers only). If the spec is already `done` it makes no edits and points you to
`/amby.specify`; otherwise it sets the spec `in-progress` and leaves completed stories untouched. Can
also extend an existing `ui.md`.

## 5. Design — UI as a first-class artifact

Produces `ui.md` (layout/wireframe, component inventory with props and states, interaction criteria)
and `design-tokens.json` (primitive → semantic → component tokens). A **sign-off gate** makes the
approved UI binding for `plan`/`tasks`/`implement`. See [UI design](./artifacts/ui-design.md).

## 6. Plan — the HOW

The first place technology appears. Chooses the stack and architecture consistent with the
constitution, and generates supporting artifacts (`data-model.md`, `contracts/`, `research.md`) as
needed. See [the plan artifact](./artifacts/plan.md).

## 7. Tasks

Turns the plan into an ordered, dependency-aware checklist: stable `T###` IDs, `[P]` parallel
markers, `[US#]` story tags, and file paths, grouped so foundational work precedes feature work. See
[the tasks artifact](./artifacts/tasks.md).

## 8. Analyze

Cross-checks spec ↔ plan ↔ tasks for coverage gaps and inconsistencies, and validates the story
**dependency graph** (cycles, dangling references, orphan stories, what's currently unblocked).

## 9. Implement

Executes tasks one slice at a time, checking off `tasks.md` checkboxes and updating each story's
`status:` as it goes — which is what `ambykit dashboard` reports on.

## Dependencies & prioritization

Stories and features carry `priority` (P1/P2/P3) and `depends-on`/`blocked-by` references by stable
ID. `tasks` orders work topologically within the foundational-first gate; `analyze` validates the
graph; `dashboard` shows blocked vs. buildable. See [the spec artifact](./artifacts/spec.md) for the
metadata shape.

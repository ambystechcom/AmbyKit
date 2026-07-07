# Artifact: `plan.md`

The plan defines **HOW** the feature is built. It is the first artifact where technology appears.
Produced by `/amby.plan` from the approved spec and UI design; must stay consistent with the
[constitution](../concepts/constitution.md).

## Sections

1. **Technical context** — chosen stack, key libraries, and the constraints that drove them.
2. **Architecture** — components, boundaries, and how they interact (diagrams welcome).
3. **Phased approach** — Phase 0 research → Phase 1 foundation (data model, contracts) → later phases.
4. **Requirement mapping** — how the design satisfies each `FR-###`/`US-#` (reference by ID, don't
   restate).
5. **Risks & decisions** — trade-offs made and why.

## Supporting artifacts (generated as needed)

- **`data-model.md`** — entities, fields, relationships, invariants.
- **`contracts/`** — API/interface specs (`openapi.yaml`, `events.md`, etc.).
- **`research.md`** — technology evaluations and decisions with rationale.

## Consistency

`/amby.analyze` cross-checks the plan against the spec: every `FR-###` should be addressed, and the
plan should not introduce requirements that aren't in the spec (scope creep). Because the plan
references spec IDs rather than copying text, changes to the spec are easy to trace forward.

## Token efficiency

The plan links to the spec and UI artifacts by `@path` and cites IDs; it does not duplicate their
content. This keeps the plan small and the downstream `tasks`/`implement` phases cheap to run.

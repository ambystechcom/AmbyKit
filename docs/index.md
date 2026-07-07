# AmbyKit Documentation

AmbyKit is a **Spec-Driven Development (SDD)** framework for AI coding assistants. You describe
*what* to build as structured, testable artifacts; AmbyKit gives your assistant a disciplined
workflow to turn those artifacts into working software — and it works across every assistant your
team uses.

## The core idea: WHAT before HOW

Most AI coding failures are requirements failures. AmbyKit separates the two concerns that usually
get tangled:

- **WHAT / WHY** — `spec.md`: user stories and testable requirements, with **no technology decisions**.
- **HOW** — `plan.md`: the technical approach, stack, and architecture, derived from the spec.

Between them sits a first-class **UI design** step (`ui.md` + `design-tokens.json`) that most spec
tools omit.

## Author once, emit per tool

You write the workflow and artifacts once. AmbyKit's **emitters** compile them into each assistant's
native format — Claude Code, OpenCode, GitHub Copilot (VS Code + CLI), Cursor (+ CLI), Antigravity
(IDE + CLI). One source of truth, no per-tool drift. See [architecture](./architecture.md).

## Read next

- [Getting started](./getting-started.md) — install and run your first feature.
- [The workflow](./workflow.md) — the eight phases in order.
- Concepts: [Spec-Driven Development](./concepts/spec-driven-development.md) ·
  [The constitution](./concepts/constitution.md)
- Artifacts: [spec](./artifacts/spec.md) · [UI design](./artifacts/ui-design.md) ·
  [plan](./artifacts/plan.md) · [tasks](./artifacts/tasks.md)
- [Tool compatibility](./tool-compatibility.md) — exact paths & formats per assistant.
- [CLI reference](./cli-reference.md)
- [Architecture](./architecture.md) · [Contributing](./contributing.md)

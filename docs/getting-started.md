# Getting started

## Requirements

- Node.js ≥ 20
- One or more supported AI coding assistants ([tool compatibility](./tool-compatibility.md))

## 1. Initialize

From your project root:

```bash
npx @ambystech/ambykit init
```

`init` will:

1. Create `.amby/` (your constitution + config) and a `specs/` directory.
2. Detect installed assistants and let you pick which to target.
3. Emit each selected tool's native command/rules files.
4. Write a shared `AGENTS.md` (and a `CLAUDE.md` bridge for Claude Code).

Re-run any time to add a tool (`ambykit add cursor`) or refresh generated files (`ambykit sync`).

## 2. Set your constitution (once)

Inside your assistant:

```
/amby.constitution
```

This captures durable, cross-feature principles — code quality bars, testing standards, UX and
performance expectations. Every later phase honors it. See
[the constitution](./concepts/constitution.md).

## 3. Specify a feature

```
/amby.specify Add password reset via emailed one-time link
```

Produces `specs/001-password-reset/spec.md` with user stories (`US-#`), EARS requirements (`FR-###`),
Given/When/Then acceptance criteria, and success criteria (`SC-###`). Ambiguities are flagged inline
as `[NEEDS CLARIFICATION: …]`.

## 4. Clarify, design, plan, break down

```
/amby.clarify      # answer open questions; markers get resolved in place
/amby.design       # ui.md + design-tokens.json (with a sign-off gate)
/amby.plan         # plan.md — the technical HOW
/amby.tasks        # tasks.md — ordered, dependency-aware checklist
```

## 5. Implement and track

```
/amby.implement    # work through tasks.md, checking off tasks as it goes
```

From the terminal, watch progress across the story/task graph:

```bash
npx ambykit dashboard          # table of all stories with % complete
npx ambykit dashboard US-3     # detail for one story
```

## Where things live

```
.amby/constitution.md          your project principles
.amby/config.json              which tools are enabled
specs/NNN-feature/
  spec.md  ui.md  design-tokens.json  plan.md  tasks.md
AGENTS.md                      shared instructions (native to most tools)
CLAUDE.md                      Claude Code bridge (imports @AGENTS.md)
```

Next: [the workflow in detail](./workflow.md).

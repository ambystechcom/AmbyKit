---
feature: 005-analyze-and-release
title: Dependency-graph analysis + release readiness
branch: main
status: done
created: 2026-07-07
---

# Spec — Dependency-graph analysis + release readiness

> Final milestone: a machine-checkable analyzer, a CI self-host gate, and npm publish prep.

## User scenarios & testing

### US-1 — Validate the dependency graph locally  (priority: P1)

As a developer, I want `ambykit analyze` to check my story graph for cycles, dangling references, and
blocked/buildable status, so that I catch inconsistencies before building — at zero model cost.

- **Independent test:** run `ambykit analyze` on this repo and on crafted cyclic/dangling inputs.
- **status:** done

**Acceptance criteria**
- Given a cyclic graph, When `analyze` runs, Then it reports a cycle and exits non-zero.
- Given a reference to a non-existent story, When `analyze` runs, Then it reports a dangling reference.
- Given blockers that are done, When `analyze` runs, Then dependent stories are reported buildable.

### US-2 — CI keeps the repo self-hosted  (priority: P1)

As a maintainer, I want CI to fail if generated files drift from the neutral source, so that the repo
always dogfoods a faithful AmbyKit output.

- **Independent test:** CI runs `sync --check` and `analyze`.
- **status:** done

**Acceptance criteria**
- Given a push/PR, When CI runs, Then it type-checks, tests, builds, and runs `sync --check` + `analyze`.

### US-3 — Publishable npm package  (priority: P2)

As a user, I want to install AmbyKit from npm with everything it needs, so that `init`/`sync` work.

- **Independent test:** `npm pack --dry-run` includes dist + templates + prompts + reference.
- **status:** done

**Acceptance criteria**
- Given the package, When packed, Then it includes `dist/`, `src/templates`, `src/prompts`, `src/reference`, `LICENSE`, `README`.
- Given `prepublishOnly`, When publishing, Then the build runs first.

## Requirements (EARS)

- FR-001  WHEN `analyze` finds a cycle or dangling reference, THE SYSTEM SHALL exit with a non-zero code.
- FR-002  THE SYSTEM SHALL compute analysis locally from `specs/` with no model tokens.
- FR-003  WHEN CI runs, THE SYSTEM SHALL fail if `sync --check` reports drift.
- FR-004  THE SYSTEM SHALL ship the templates, prompts, and reference docs needed by `init`/`sync`.

## Success criteria

- SC-001  `ambykit analyze` on this repo reports no structural issues.
- SC-002  `npm pack --dry-run` lists the runtime templates/prompts/reference.

## Assumptions

- Publishing to npm as `@ambystech/ambykit` (public scope) is done by a maintainer with access.

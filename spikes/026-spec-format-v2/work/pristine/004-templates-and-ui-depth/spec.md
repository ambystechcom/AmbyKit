---
feature: 004-templates-and-ui-depth
title: Template installation + UI-design depth
branch: main
status: done
created: 2026-07-07
---

# Spec — Template installation + UI-design depth

> Wires the workflow to its templates and deepens the UI-design artifact (AmbyKit's differentiator).

## User scenarios & testing

### US-1 — Prompts use installed, customizable templates  (priority: P1)

As a developer, I want each phase to author artifacts from templates that live in my project, so that
I can customize them and the assistant produces consistent output.

- **Independent test:** run `init`, confirm `.amby/templates/*` exist and prompts reference them by `@path`.
- **status:** done

**Acceptance criteria**
- Given `ambykit init`, When it runs, Then it installs `.amby/templates/*` and `.amby/reference/*`.
- Given a customized template, When `sync` runs, Then it is not overwritten (write-if-absent).
- Given the specify phase, When invoked, Then it references `@.amby/templates/spec.md`.

### US-2 — UI design has real depth  (priority: P1)

As a developer, I want the design phase to capture wireframes, component specs, tokens, and a11y with
a sign-off gate, so that generated UI is intentional.

- **Independent test:** inspect the `ui.md` template and `design-conventions.md` reference.
- **status:** done

**Acceptance criteria**
- Given the design phase, When invoked, Then it loads `@.amby/reference/design-conventions.md` on demand.
- Given `ui.md`, When authored, Then it cites token names (not raw values) and includes a sign-off gate.

## Requirements (EARS)

- FR-001  WHEN `init` runs, THE SYSTEM SHALL install artifact templates into `.amby/templates/`.
- FR-002  WHEN installing a template that already exists, THE SYSTEM SHALL leave it unchanged.
- FR-003  WHEN `sync`/`upgrade` runs, THE SYSTEM SHALL add newly-introduced templates without clobbering existing ones.
- FR-004  THE SYSTEM SHALL keep heavy design guidance in a reference doc loaded only by the design phase (token frugality).

## Success criteria

- SC-001  A fresh project's `/amby.specify` and `/amby.design` reference project-local templates.
- SC-002  Editing a project's `.amby/templates/spec.md` survives `sync`.

## Assumptions

- Templates ship in the npm package under `src/templates` + `src/reference` and are copied on install.

---
feature: 004-templates-and-ui-depth
created: 2026-07-07
---

# Tasks — Template installation + UI-design depth

## Phase 1 — User story US-2 — UI depth  (priority: P1)

- [x] [T010] [US2] Enrich ui.md template (states, token names, a11y) (src/templates/ui.md)
- [x] [T011] [US2] Add design-conventions reference (src/reference/design-conventions.md)

## Phase 2 — User story US-1 — Template install + wiring  (priority: P1)

- [x] [T020] [US1] installArtifactTemplates + referenceDir (src/core/scaffold.ts, src/core/paths.ts)
- [x] [T021] [US1] init installs templates (src/cli/init.ts)
- [x] [T022] [US1] sync adds new templates write-if-absent (src/cli/sync.ts)
- [x] [T023] [US1] Reference templates from prompts via @path (src/prompts/*.md)
- [x] [T024] [US1] Ship src/reference in npm package (package.json)

## Phase 3 — Polish

- [x] [T090] Tests: installArtifactTemplates (test/scaffold.test.ts)
- [x] [T091] Re-sync repo: install .amby/templates + regenerate commands; sync --check clean

---
feature: 004-templates-and-ui-depth
created: 2026-07-07
---

# Tasks — Template installation + UI-design depth

## Phase 1 — User story US-2 — UI depth  (priority: P1)

- [x] [T010] [US2] Enrich ui.md template (states, token names, a11y)
- [x] [T011] [US2] Add design-conventions reference

```yaml
files:
  T010: ["src/templates/ui.md"]
  T011: ["src/reference/design-conventions.md"]
```

## Phase 2 — User story US-1 — Template install + wiring  (priority: P1)

- [x] [T020] [US1] installArtifactTemplates + referenceDir
- [x] [T021] [US1] init installs templates
- [x] [T022] [US1] sync adds new templates write-if-absent
- [x] [T023] [US1] Reference templates from prompts via @path
- [x] [T024] [US1] Ship src/reference in npm package

```yaml
files:
  T020: ["src/core/scaffold.ts", "src/core/paths.ts"]
  T021: ["src/cli/init.ts"]
  T022: ["src/cli/sync.ts"]
  T023: ["src/prompts/*.md"]
  T024: ["package.json"]
```

## Phase 3 — Polish

- [x] [T090] Tests: installArtifactTemplates
- [x] [T091] Re-sync repo: install .amby/templates + regenerate commands; sync --check clean

```yaml
files:
  T090: ["test/scaffold.test.ts"]
```

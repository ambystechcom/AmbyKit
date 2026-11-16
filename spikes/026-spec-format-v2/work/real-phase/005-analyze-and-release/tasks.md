---
feature: 005-analyze-and-release
created: 2026-07-07
---

# Tasks — Dependency-graph analysis + release readiness

## Phase 1 — User story US-1 — analyze  (priority: P1)

- [x] [T010] [US1] Graph analyzer: cycles, dangling, blocked/buildable, orphans
- [x] [T011] [US1] AnalyzeCommand + register
- [x] [T012] [US1] Tests for the analyzer

```yaml
files:
  T010: ["src/core/analyze.ts"]
  T011: ["src/cli/analyze.ts", "src/cli/index.ts"]
  T012: ["test/analyze.test.ts"]
```

## Phase 2 — User story US-2 — CI self-host gate  (priority: P1)

- [x] [T020] [US2] CI workflow: typecheck, test, build, sync --check, analyze

```yaml
files:
  T020: [".github/workflows/ci.yml"]
```

## Phase 3 — User story US-3 — release readiness  (priority: P2)

- [x] [T030] [US3] LICENSE (MIT)
- [x] [T031] [US3] package.json: repository/homepage/bugs + prepublishOnly
- [x] [T032] [US3] Verify `npm pack --dry-run` contents
- [x] [T033] [P] [US3] Document analyze in CLI reference + README

```yaml
files:
  T031: ["package.json"]
  T033: ["docs/cli-reference.md", "README.md"]
```

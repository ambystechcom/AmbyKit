---
feature: 002-copilot-emitters
created: 2026-07-07
---

# Tasks — GitHub Copilot emitters (VS Code + CLI)

## Phase 1 — Foundational

- [x] [T010] Add `transformBody` hook to BaseEmitter
  ```yaml
  files: ["src/emitters/base-emitter.ts"]
  ```

## Phase 2 — User story US-1 — Copilot VS Code  (priority: P1)

- [x] [T020] [US1] CopilotEmitter: prompt files + copilot-instructions
  ```yaml
  files: ["src/emitters/copilot.ts"]
  ```
- [x] [T021] [US1] $ARGUMENTS → ${input:args} transform
  ```yaml
  files: ["src/emitters/copilot.ts"]
  ```
- **Checkpoint:** `.github/prompts/amby.*.prompt.md` generated.

## Phase 3 — User story US-2 — Copilot CLI  (priority: P1)

- [x] [T030] [US2] CopilotCliEmitter extends CopilotEmitter; skills surface
  ```yaml
  files: ["src/emitters/copilot-cli.ts"]
  ```
- [x] [T031] [US2] Register copilot + copilot-cli targets
  ```yaml
  files: ["src/emitters/index.ts"]
  ```
- **Checkpoint:** `.github/skills/amby-*/SKILL.md` generated.

## Phase 4 — Polish

- [x] [T090] Tests: Copilot + Copilot CLI emitters
  ```yaml
  files: ["test/copilot-emitter.test.ts"]
  ```
- [x] [T091] Verify `ambykit add copilot copilot-cli` end-to-end in a temp project

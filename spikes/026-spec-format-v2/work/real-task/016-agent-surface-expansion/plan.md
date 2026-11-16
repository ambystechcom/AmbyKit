---
feature: 016-agent-surface-expansion
status: ready
created: 2026-10-26
---

# Implementation Plan — Agent surface expansion — eight new assistants, verified formats only

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`. Formats
> come from `@research.md` (Phase 0, done) and are not restated here.

## Technical context

- **Stack:** Node ≥ 20, TypeScript ESM, Vitest. **No new runtime dependencies.** TOML is written by a
  20-line serializer, because only two string keys are emitted, and AmbyKit never parses TOML.
- **Constraints:**
  - **P1:** every target is generated from `src/prompts/`, with no per-tool source.
  - **P2:** two abstract helpers carry the new shapes, `TomlCommandEmitter` and `SkillsEmitter`.
    Each target is a 15–30 line subclass, or an alias entry.
  - **P4:** only formats in `research.md` are used. Unverified surfaces (Kiro prompts, persona files)
    are not emitted.
  - **P5:** one snapshot-style test per target, plus a golden test proving the ten existing targets
    are byte-identical.
  - **P7:** every new path is project-scoped. No user-level or tool-settings files are written.

## Architecture

```
BaseEmitter.commandFile(spec)  ── template method (unchanged contract)
   ├─ commandFrontmatter / transformBody / commandFilePath      (existing hooks)
   └─ renderCommand(pairs, notice, body)   NEW hook; default = today's `---`/notice/body join
        │
        ├─ TomlCommandEmitter (abstract)  renderCommand → `# notice` + description + prompt '''…'''
        │     ├─ GeminiEmitter   .gemini/commands/amby.<phase>.toml   + GEMINI.md pointer region
        │     └─ LlxprtEmitter   .llxprt/commands/amby.<phase>.toml   + LLXPRT.md pointer region
        ├─ SkillsEmitter (abstract)  skillName / SKILL.md path / name+description / $ARGUMENTS→prose
        │     ├─ CodexEmitter      .agents/skills   (refactored onto it; output unchanged)
        │     ├─ CopilotCliEmitter (refactored onto it; output unchanged)
        │     └─ KiroEmitter       .kiro/skills
        ├─ QwenEmitter      .qwen/commands/*.md      description, argument-hint; $ARGUMENTS→{{args}}
        ├─ KiloEmitter      .kilo/commands/*.md      description
        ├─ AugmentEmitter   .augment/commands/*.md   description, argument-hint
        └─ WindsurfEmitter  .windsurf/workflows/*.md no frontmatter; $ARGUMENTS→prose; ≤12,000 chars
TARGETS += gemini, llxprt, qwen, kilo, augment, windsurf, kiro, pi (alias → codex)
```

- **The base change (FR-004/010):**
  - `commandFile` today joins frontmatter, notice and body inline. That join moves, unchanged, into
    `protected renderCommand(pairs, notice, body)`.
  - `commandFileName` already exists, so the TOML subclasses override it to `<name>.toml`.
  - Nothing else in `BaseEmitter` changes. The golden test (T002, written *before* the refactor) is
    the proof.
- **TOML serialization** (`TomlCommandEmitter`, R1):
  - Output is `# <notice>`, then `description = "<basic-escaped>"`, then `prompt = '''\n<body>\n'''`.
  - If the body contains `'''`, the prompt falls back to a basic `"""` string with `\` and `"`
    escaped.
  - `transformBody` maps `$ARGUMENTS` to `{{args}}`.
  - A guard test asserts that no neutral prompt contains `!{`, `@{` or `'''` today.
- **Rules (FR-009):**
  - Gemini and LLxprt add one pointer-region file each (`GEMINI.md`, `LLXPRT.md`) through
    `buildPointerRegion`. That merges non-destructively, exactly like Cursor's and Copilot's pointers.
  - Every other new target reads `AGENTS.md`, so no rules file is emitted for it (Qwen per R3).
- **Shared directories (FR-007, R5):**
  - Pi is a `TARGETS` alias of the Codex emitter, so `emittersForTargets` dedupes it and the files
    are written once. The owners are the configured targets resolving to that emitter, and
    `ambykit check` prints them for shared outputs.
  - A new guard in `buildEmittedFiles` throws when two emitters produce the **same path with
    different contents**, naming both tool ids. The guard has no effect on current targets
    (Antigravity `.agents/workflows` and Codex `.agents/skills` are disjoint).
- **The selector (FR-013):** `renderPromptLines` gains a scrolling viewport with
  `rows = min(options, terminalRows − 6)`. The cursor stays visible, with `↑ n more` / `↓ n more`
  hints, ASCII fallbacks and no new tokens. At 18 targets on a 24-row terminal, every option is
  reachable.
- **Doctor (FR-012):** `ambykit check` already diffs `buildEmittedFiles` against disk. New targets are
  covered by registration, and an e2e test proves it per target.
- **Presence (017 coupling):**
  - `AgentFamily` gains `gemini`, `qwen`, `llxprt`, `kiro`, `kilo`, `augment` and `windsurf`. Pi
    reports as `codex` (R5).
  - `AGENTS` gets an entry per new target id, with executables only where T011 verifies them (R9).
  - 017's design tokens gain one glyph, ASCII tag and color per new family, keeping 017's AA contrast
    rule, and are mirrored in `live-tokens.ts`. The existing mirror and coverage tests enforce this.

## Phased approach

- **Phase 0 — Research:** done, see `research.md`. The remaining checks are the matrix write-up and
  the executable names (T010, T011).
- **Phase 1 — Foundation:** the golden test for existing output, then the `renderCommand` hook, the
  `SkillsEmitter` extraction, and the collision guard.
- **Phase 2+ — Stories:** US-1 (matrix), then US-3 (TOML, the architectural risk first), US-2
  (markdown targets), US-4 (Kiro and Pi), and finally US-5 (selector, doctor, docs, tokens).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `docs/tool-compatibility.md` gains eight columns and source lines from `research.md` |
| FR-002 | Amazon Q and the unverified surfaces are listed under "Out of scope" in the matrix |
| FR-003 | Eight `TARGETS` entries (seven emitters plus the Pi alias) |
| FR-004 | The `renderCommand` hook and `TomlCommandEmitter`, with an escaping test |
| FR-005 | `transformBody` for Windsurf and Kiro rewords `$ARGUMENTS` into prose (the Codex wording) |
| FR-006 | Subclasses override only paths, frontmatter, body transform and rules |
| FR-007 | Pi alias dedupe, owner listing in `check`, and the same-path/different-content guard |
| FR-008 | No out-of-tree paths are introduced; an assertion keeps every new file `scope: "project"` |
| FR-009 | `GEMINI.md`/`LLXPRT.md` pointer regions; none for AGENTS.md-native targets |
| FR-010 | The golden test over the ten existing targets, recorded before the refactor |
| FR-011 | One test per target asserting paths and frontmatter against the matrix |
| FR-012 | `ambykit check` e2e per new target: present, then drift detected after a hand edit |
| FR-013 | Selector viewport plus tests at 18 options and 12 rows |
| FR-014 | README, `docs/workflow.md`, `docs/cli-reference.md`, site compatibility page; docs-sync |
| SC-005 | e2e: edit one prompt in a temp copy, sync with all targets, `sync --check` clean |
| SC-006 | Manual, recorded in `research.md`: Gemini CLI loads `/amby.specify` from the emitted TOML |

## Risks & decisions

- **The refactor could change existing output.** The golden test lands first, in its own commit, and
  a byte-identical result is a hard gate.
- **Windsurf's `.windsurf/` is called legacy upstream (R4).** If it stops being read, the switch is
  one field plus a matrix row (US-5's "one emitter, one snapshot").
- **Qwen's AGENTS.md support is source-only (R3).** It is in the live-verify list, with a cheap
  fallback.
- **The 12,000-character Windsurf limit.** The largest prompt today is well under it, and a test fails
  the build if any emitted workflow exceeds it.
- **Lands after 014.** 014 is done, so the phase set is final and the snapshots are written once.

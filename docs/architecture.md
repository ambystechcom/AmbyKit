# Architecture

AmbyKit is a Node/TypeScript CLI (`@ambystech/ambykit`) built on two ideas: **author once, emit per
tool**, and **token frugality**.

## Author once, emit per tool

There is one neutral source of truth. Emitters compile it into each assistant's native format.

```
src/templates/  ── artifact templates (constitution, spec, ui, design-tokens, plan, tasks)
src/prompts/    ── neutral phase CommandSpecs (constitution → implement)
        │
        ▼  ambykit init / add / sync
   ┌────────────┐
   │  Emitters  │  BaseEmitter + per-tool subclasses
   └────────────┘
        │
        ├── .claude/commands/amby/*.md        (ClaudeEmitter)
        ├── .github/prompts/*.prompt.md       (CopilotEmitter)
        ├── .github/skills/amby-*/SKILL.md    (CopilotCliEmitter)
        ├── .opencode/commands/*.md           (OpenCodeEmitter)
        ├── .cursor/commands/*.md + rules     (CursorEmitter / CursorCliEmitter)
        ├── .agents/skills/amby-*/SKILL.md    (CodexEmitter, AntigravityEmitter / AntigravityCliEmitter)
        └── AGENTS.md (+ CLAUDE.md bridge)     (shared rules layer)
```

On `init`, the neutral source is also copied into the consumer's `.amby/` so their project owns its
templates and can customize them.

## `BaseEmitter`

An abstract class holding all shared state and behavior; each tool is a thin subclass.

- **Properties:** `toolId`, `displayName`, `commandDir`, `rulesFile`, `commandSurface`
  (`'commands' | 'skills' | 'workflows' | 'none'`), `supportsAgents`.
- **Template method** `emit(specs, ctx): EmittedFile[]` — orchestrates: resolve target dir → render
  rules file → render each phase prompt **via `commandSurface`** → collect files. Subclasses don't
  re-implement orchestration. MCP setup is a separate, opt-in hook (below), so `emit` is unchanged.
- **Overridable hooks:** `commandFrontmatter(spec)`, `commandPath(spec)`, `rulesContent(ctx)`,
  `mcpFiles(ctx)` and `mcpSkipReason()`. Defaults live in the base; a subclass overrides only its
  differences. `buildEmittedFiles` calls `mcpFiles` only when `config.mcp.enabled`; a target whose per-server
  entry shape is not verified in the compatibility matrix returns no files and a reason, which `sync`
  prints. The files use `merge: "json"`, which splices the single `ambykit` server entry into the tool's JSON
  config and leaves every other key as written (`src/core/merge-json.ts`).
- **Reuse subclasses:** `CursorCliEmitter` (`commandSurface: 'none'`) and `AntigravityCliEmitter`
  reuse a sibling's output; VS Code extension targets resolve to their base tool's emitter unchanged
  via the **target→emitter map** in the registry.

Adding a tool = one subclass + a compatibility-matrix row + a snapshot test.

## `BaseCommand`

The CLI verbs mirror the same pattern. An abstract `BaseCommand` holds project/`.amby/` discovery,
config load/save, emitter resolution, tool detection, logging, error handling, and `--dry-run`/
`--yes`. Its template method `run()` validates context then calls each subclass's `execute()`.
Subclasses: `InitCommand`, `AddCommand`, `SyncCommand`, `CheckCommand`, `RestoreCommand`,
`UpgradeCommand`, `DashboardCommand`.

## One dependency graph

Story and feature dependencies are read once and resolved once. `parseStories` reads the `depends-on` and
`blocked-by` lines; `buildGraph` (`src/core/graph.ts`) turns every feature's stories into one pure,
deterministic graph of story nodes, story edges (`depends-on` and `blocked-by` kept apart), feature edges
derived from them, broken edges and cycles. `analyze`, the dashboard's attention list and story detail,
`ambykit graph`, and later the run scheduler and the MCP server all read dependencies from that graph and
never parse specs themselves; a guard test keeps it that way. Questions asked of the graph (which stories
are buildable, what blocks a story, the critical path) live in `graph-paths.ts`, and the text, JSON and
Mermaid formats in `graph-format.ts`. The interactive graph view loads only on the interactive dashboard,
through a dynamic import, so one-shot and `--json` output stay inside the 1-second budget.

## Non-destructive rules merge (brownfield)

Generated **command** files are AmbyKit's alone and are overwritten. **Rules files** (`AGENTS.md`,
the `CLAUDE.md` bridge, `copilot-instructions.md`, Cursor's `.mdc`) are different: a user may have
authored them. Each such `EmittedFile` is tagged `merge: "region"`, and the writer (`applyFiles`)
reconciles it through a pure core (`src/core/merge.ts`) instead of overwriting:

- The AmbyKit-owned span is a Markdown section that opens with `### AmbyKit usage` and ends at the
  next same-or-higher heading (or EOF). On a fresh file the whole emitted file is written; on an
  existing file only that region is spliced in, preserving every other byte.
- A short **fingerprint** is embedded in the region footer. On re-run, a region whose body no longer
  matches its fingerprint was hand-edited, so it is left untouched and reported as *skipped*.
- Before modifying an existing file, the writer copies it to `.amby/backups/<name>.<ts>.bak`
  (`ambykit restore` reverses this). Backups are outside the emitted set, so `check` stays green.
- `classifyProject` (`src/core/classify.ts`) labels a project greenfield/brownfield from three
  signals — an existing rules file, non-AmbyKit source files, or a git history — defaulting to the
  safe (non-destructive) path when uncertain.

## Token efficiency

Spec generation must be cheap. This is designed into the prompts and templates:

- **Progressive disclosure** — each phase loads only the artifact it needs via `@path`
  (specify→constitution, plan→spec, tasks→plan, implement→one task slice). Reference material (EARS
  guide, examples) lives in separate on-demand files, not inlined in every prompt.
- **Reference by stable ID** — downstream artifacts cite `US-#`/`FR-###`/`SC-###` instead of copying
  text.
- **Patch, don't regenerate** — `clarify` edits only clarification markers; `implement` flips
  checkboxes and updates `status:` in place.
- **Structured over prose for machine reads** — `dashboard` and `analyze` parse frontmatter and
  checkboxes locally in the CLI at **zero model tokens**; only generative phases call the model.

## Self-hosting

AmbyKit is built with AmbyKit. The repo's own `.claude/` (and other tool files) are generated by
`ambykit sync` from `src/prompts/`; CI asserts `sync` produces no diff so the repo stays a faithful
consumer of itself. See [contributing](./contributing.md).

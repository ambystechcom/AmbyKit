# CLI reference

`@ambystech/ambykit`, bin name `ambykit`. Run via `npx @ambystech/ambykit <command>` or install and
use `ambykit <command>`.

## Global flags

- `--verbose` — detailed logging.
- `--dry-run` — show what would change without writing files.
- `--yes` — assume yes for prompts (non-interactive).

## `ambykit init [dir]`

Scaffold AmbyKit in a project. Creates `.amby/` (constitution + `config.json`) and `specs/`, detects
installed assistants, lets you select targets, emits their native files, and writes the shared
`AGENTS.md` (+ `CLAUDE.md` bridge for Claude Code).

```bash
npx @ambystech/ambykit init
npx @ambystech/ambykit init . --yes
```

## `ambykit add <tool…>`

Add or refresh integration for one or more targets (see [tool compatibility](./tool-compatibility.md)
for target names).

```bash
ambykit add cursor claude
```

## `ambykit sync`

Re-emit all configured tools from the neutral source. Run after upgrading AmbyKit or editing
`.amby/` templates/prompts. Project-scoped files only by default; user-level MCP files are opt-in.

```bash
ambykit sync
ambykit sync --dry-run
```

## `ambykit dashboard [story-id]`

Progress view over the story/task graph, computed locally from `specs/*/spec.md` + `tasks.md` (no
model tokens).

- **No arg** — a table of all user stories: `Feat | Story | description | X of Y tasks | % | status | priority | blocked-by`, with an overall roll-up.
- **`story-id`** — detail for one story. Story ids **restart per feature**, so a bare `US-3` may
  match several; qualify it with the feature ref as `NNN:US-3` (also accepts `NNN/US-3`). A bare id
  that matches more than one feature prints the matches so you can pick.

```bash
ambykit dashboard
ambykit dashboard 001:US-3        # feature-qualified (recommended)
ambykit dashboard --status blocked
ambykit dashboard --feature 001-password-reset
ambykit dashboard --json
```

## `ambykit analyze`

Validate the story dependency graph, computed locally from `specs/` (no model tokens): detects
**cycles** and **dangling references** (structural errors), and reports **blocked** vs **buildable**
stories and **orphans** (stories with no tasks). Exits non-zero on structural errors, so it can gate
CI. Complements the generative `/amby.analyze` phase.

```bash
ambykit analyze
ambykit analyze --json
```

## `ambykit check`

Doctor: verify integrations are present and well-formed and that expected assistant CLIs are
installed. Reports drift between the neutral source and emitted files.

## `ambykit upgrade`

Update AmbyKit to the latest version and re-run `sync`.

```bash
ambykit upgrade --dry-run
```

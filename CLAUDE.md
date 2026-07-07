@AGENTS.md

# Claude Code — notes for the AmbyKit repo

The shared, tool-neutral guidance is in `@AGENTS.md` above (imported). This file adds only
Claude-Code-specific notes. Claude Code does **not** read `AGENTS.md` natively — the `@AGENTS.md`
import on the first line is the bridge, so keep it there.

## Claude-specific

- The AmbyKit workflow is available here as slash commands under `/amby.*` (e.g. `/amby.specify`,
  `/amby.design`, `/amby.plan`, `/amby.tasks`). These live in `.claude/commands/amby.*.md` and are
  **generated** from `src/prompts/` — edit the neutral prompt, not the command file, then
  `ambykit sync`.
- When you finish a nontrivial change, run `npm run typecheck` and `npm test` before committing.
- Keep this repo self-hosted: after changing `src/templates/` or `src/prompts/`, regenerate the
  repo's own tool files with `ambykit sync` (once the CLI exists) so `.claude/` stays current.

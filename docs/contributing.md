# Contributing

AmbyKit is built **with** AmbyKit. Read [`AGENTS.md`](../AGENTS.md) first — it has the golden rules
for working in this codebase.

## Setup

```bash
npm install
npm run build       # compile to dist/ (ESM, NodeNext)
npm run typecheck   # type-check only
npm test            # vitest: emitter snapshot tests + CLI e2e
```

Node ≥ 20, ESM only. Use `.js` extensions in relative imports.

## The two golden rules

1. **Author once, emit per tool.** Never hand-edit generated tool files (`.claude/commands/`,
   `.github/prompts/`, …). Edit the neutral source in `src/templates/` or `src/prompts/`, then
   `ambykit sync`.
2. **Subclass, don't duplicate.** New tool = a `BaseEmitter` subclass; new CLI verb = a `BaseCommand`
   subclass. Override only what differs.

## Adding a tool emitter

1. Read the tool's real format and add/verify a row in
   [`docs/tool-compatibility.md`](./tool-compatibility.md). Don't guess formats.
2. Create `src/emitters/<tool>.ts` extending `BaseEmitter`; set `commandSurface`, paths, and MCP
   keys/scope; override only the differing hooks.
3. Register it (and any VS Code-extension alias) in `src/emitters/index.ts`.
4. Add a snapshot test asserting generated paths and frontmatter match the matrix.

## Adding or changing a phase

1. Edit the neutral `CommandSpec` in `src/prompts/` and any template in `src/templates/`.
2. Keep it **token-frugal**: load only needed artifacts by `@path`, reference IDs instead of
   restating, patch in place. See [architecture → token efficiency](./architecture.md).
3. Run `ambykit sync` to regenerate this repo's own tool files and commit them.

## Dogfooding & CI

Features are specced under `specs/` using the AmbyKit workflow. CI asserts `ambykit sync` produces no
diff, so the repo stays a faithful consumer of itself. If your change touches emitters or prompts,
run `ambykit sync` and include the regenerated files in your commit.

## Commit / PR

- Keep changes small and focused; update docs and the compatibility matrix alongside code.
- Ensure `npm run typecheck` and `npm test` pass before opening a PR.

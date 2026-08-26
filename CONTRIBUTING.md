# Contributing to AmbyKit

Thanks for taking the time. Two documents matter before you start:

- **[`AGENTS.md`](./AGENTS.md)** — the golden rules for working in this codebase (author once /
  emit per tool, `BaseEmitter` and `BaseCommand` hold shared logic, token frugality, dogfooding).
  Read this first; it applies to humans and AI assistants alike.
- **[`docs/contributing.md`](./docs/contributing.md)** — the full contributor guide: setup, adding a
  tool emitter, adding or changing a phase, CI expectations.

## Quick start

```bash
npm install
npm run build       # compile to dist/ (ESM, NodeNext)
npm run typecheck   # type-check only
npm test            # vitest: emitter snapshot tests + CLI e2e
```

Node ≥ 20, ESM only. Use `.js` extensions in relative imports.

## Before you open a PR

1. `npm run typecheck` and `npm test` pass.
2. If you touched `src/emitters/` or `src/prompts/`, run `ambykit sync` and commit the regenerated
   files — CI asserts a sync produces no diff.
3. If you added or changed a phase, verb, or target, update `docs/` **and** the site pages;
   `node scripts/check-docs-sync.mjs` gates the site build.
4. Never hand-edit generated tool files (`.claude/commands/`, `.github/prompts/`, …). Edit the
   neutral source and re-sync.

## Reporting things

- **Bugs and feature requests:** [open an issue](https://github.com/ambystechcom/AmbyKit/issues/new/choose).
- **Questions and ideas:** [Discussions](https://github.com/ambystechcom/AmbyKit/discussions).
- **Security vulnerabilities:** do not open an issue — see [`SECURITY.md`](./SECURITY.md).

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## What this changes

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## Why

<!-- The problem it solves. If this came from a spec under specs/, name the feature dir. -->

## Checklist

- [ ] `npm run typecheck` and `npm test` pass
- [ ] If I touched `src/emitters/` or `src/prompts/`, I ran `ambykit sync` and committed the
      regenerated files (CI asserts a sync produces no diff)
- [ ] If I added or changed a phase, verb, or target, I updated `docs/` **and** the site pages, and
      `node scripts/check-docs-sync.mjs` passes
- [ ] I did not hand-edit any generated tool file (`.claude/commands/`, `.github/prompts/`, …)
- [ ] New tool support: the format is backed by official docs and `docs/tool-compatibility.md` is
      updated, with a snapshot test — not guessed

## Notes for reviewers

<!-- Anything surprising, any tradeoff you want a second opinion on. -->

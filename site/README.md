# AmbyKit documentation site

The user-facing docs for AmbyKit — an [Astro Starlight](https://starlight.astro.build/) site,
styled with Tailwind v4 and the ambystech brand, with Mermaid diagrams. Standalone package (its own
deps); it is **not** part of the `@ambystech/ambykit` CLI package.

> `docs/` (repo root) is separate — it is contributor / AI-agent guidance for working *on* AmbyKit.
> This `site/` is the product documentation for *users*.

## Develop

```bash
cd site
npm install
npm run dev          # local dev server
npm run build        # static build → site/dist
npm run preview      # preview the production build
```

## Keeping docs in sync

Workflow/command **facts** on the site are checked against the source of truth
(`src/prompts` + the CLI/emitter registries) by the repo-root script:

```bash
node scripts/check-docs-sync.mjs
```

CI runs this before every build (`.github/workflows/site.yml`), so drift blocks the GitHub Pages
deploy. See `specs/007-documentation-site/contracts/docs-sync.md` for the checked invariants.

## Deploy

Pushing to `main` (touching `site/**` or `src/prompts/**`) builds and publishes to the repository's
GitHub Pages via `.github/workflows/site.yml`. The site is served under `/AmbyKit/`
(`base` in `astro.config.mjs`; override with `AMBYKIT_BASE` for a custom domain).

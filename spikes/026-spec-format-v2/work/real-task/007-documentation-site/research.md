---
feature: 007-documentation-site
kind: research
created: 2026-07-07
---

# Research — AmbyKit documentation site

Decisions for `@plan.md`. The framework/styling/diagram/host stack was **mandated** (Astro Starlight
+ Tailwind + Mermaid + GitHub Pages), so research focuses on the *integration* decisions those imply.

## D1 — Mermaid rendering: client-side wrapper with a DOM text fallback

| Option | No-JS / a11y | Light-dark theming | CI cost | Verdict |
|---|---|---|---|---|
| **Client-side `Diagram` wrapper** (chosen) | caption/summary always in DOM → readable | re-reads CSS vars on theme toggle → live | none | Fits FR-005/007 + edge cases. |
| `rehype-mermaid` inline-SVG (build-time) | best (static SVG) | one baked SVG can't swap colors per mode | needs Playwright in CI | Rejected: no live theming + heavy CI. |
| Raw client Mermaid, no fallback | breaks with no-JS | ok | none | Rejected: fails the no-JS edge case. |

**Decision:** `Diagram.astro` renders Mermaid on the client, seeds `themeVariables` from the
`component.mermaid.*` CSS custom properties, and re-initializes on the Starlight theme change. It
**always** emits the caption + one-line text summary in the DOM, satisfying the no-JS and
render-failure fallbacks. (`astro-mermaid` is a viable drop-in alternative if hand-rolling proves
fiddly.)

## D2 — Tailwind ↔ Starlight reconciliation

Starlight ships its own design system (CSS custom properties, resets). Adding Tailwind naively causes
preflight/specificity clashes.

**Decision:** use `@astrojs/tailwind` **with `@astrojs/starlight-tailwind`**, which adapts Tailwind's
preflight to Starlight and wires Tailwind's color theme to Starlight's `--sl-*` variables. Brand
colors are applied primarily through Starlight CSS vars (`theme.css`); Tailwind utilities are used for
the custom components (Hero, phase cards, compatibility table). One token source (`design-tokens.json`
→ `tokens.css`) feeds both, so utilities and Starlight agree.

## D3 — FR-014 docs-sync: CI-check the facts, hand-author the prose

| Option | Principle 1 | Prose quality | Verdict |
|---|---|---|---|
| **Generate facts, check pages** (chosen) | source stays `src/prompts`; drift fails CI | hand-authored → good | Best balance. |
| Fully generate pages from CommandSpec `body` | perfect | prompt bodies are agent instructions, not user prose | Rejected: poor UX. |
| Hand-author, no check | none | good | Rejected: silent drift (violates P1/P6). |

**Decision:** `scripts/check-docs-sync.mjs` loads the neutral CommandSpecs from `src/prompts` and the
CLI verb + tool registries, then asserts: every workflow phase has exactly one page; each page's
frontmatter `command`/`reads`/`writes` matches its CommandSpec; the CLI-reference page lists every
verb; the compatibility page lists every target. Runs in CI (Principle 6); prose remains
hand-authored. Contract in `@contracts/docs-sync.md`.

## D4 — GitHub Pages deploy + base path

**Decision:** project-page deployment. `.github/workflows/site.yml` triggers on pushes touching
`site/**` and `src/prompts/**`; steps: `npm ci` (in `site/`) → `node scripts/check-docs-sync.mjs` →
`astro build` → `actions/upload-pages-artifact` → `actions/deploy-pages`, with
`permissions: { pages: write, id-token: write }` and a `pages` concurrency group. Astro config sets
`site: 'https://<org>.github.io'` and `base: '/AmbyKit/'` for correct project-page URLs; Starlight's
base-aware links keep internal navigation valid (SC-003). A custom domain later reverts `base` to `/`.

## Net

No decision fights the mandate; each resolves an integration seam it creates. The only judgment call
with a real trade-off is D3 (check vs generate) — chosen to keep `src/prompts` authoritative while
keeping user-facing prose readable.

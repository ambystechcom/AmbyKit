---
feature: 007-documentation-site
status: draft
created: 2026-07-07
---

# Implementation Plan — AmbyKit documentation site

> The HOW. Satisfies every `FR-###` in `@spec.md`, renders the signed-off `@ui.md` +
> `@design-tokens.json`, and honors `@../../.amby/constitution.md`. Decisions/rationale in
> `@research.md`; the FR-014 drift check in `@contracts/docs-sync.md`. References by ID — see the
> spec/UI for WHAT/WHY.

## Technical context

- **Stack (requestor-mandated):** Astro + **Starlight** for the docs site, **Tailwind** for styling,
  **Mermaid** for diagrams, published to **GitHub Pages** — all under a top-level `site/` directory
  (FR-001). Node ≥ 20, ESM.
- **Key libraries:** `astro`, `@astrojs/starlight`, `@astrojs/tailwind` + `@astrojs/starlight-tailwind`
  (reconciles Starlight's CSS with Tailwind — `@research.md` D2), `mermaid` (client-side wrapper —
  D1). Deploy uses `actions/configure-pages` + `actions/deploy-pages` (D4).
- **Isolation constraint:** `site/` is a **standalone package** (its own `package.json`,
  `node_modules`, build) — **not** part of the `@ambystech/ambykit` CLI package. It is excluded from
  the CLI's `files`/publish and from the `ambykit sync` self-host check, so this feature can't affect
  the shipped CLI (Principle 7) or the sync gate (Principle 6). `docs/` stays as-is — the site
  **complements** it (spec Assumptions).
- **Constraints driving choices:**
  - **Principle 1 (single source of truth):** the site must not silently diverge from the workflow.
    A CI check derives the *facts* (phase list, command names, reads/writes, tool list) from
    `src/prompts` + the CLI/emitter registries and fails the build on drift (FR-014 — `@contracts/docs-sync.md`).
  - **Principle 6 (dogfood / CI-gated):** deploy + the drift check run in GitHub Actions (FR-015).
  - **Principle 3 (frugality):** phase pages reference stable IDs, not restated content (US-2).
  - **Principle 7 (least surprise):** project-scoped, standalone, reversible; no change to the CLI.

## Architecture

```
site/                              standalone Astro Starlight package
  astro.config.mjs                 Starlight+Tailwind+Mermaid; site+base for Pages (D4)
  tailwind.config.mjs
  package.json                     own deps/scripts (dev/build/preview)
  src/
    content/docs/                  MDX: index, start/, workflow/ (8 phases + overview),
                                   concepts/architecture, cli/ (reference + compatibility)
    content.config.ts              Starlight docs collection + phase-page frontmatter schema
    components/                    Hero, Diagram, PhaseBadge, Logo, Header (Starlight overrides)
    styles/                        tokens.css (design-tokens → CSS vars), theme.css (light/dark),
                                   brand.css (palette applied), mermaid.ts (Mermaid theme from tokens)
  public/                          favicon + logo (placeholder → PNG when supplied)
scripts/check-docs-sync.mjs        FR-014 drift check (reads src/prompts + registries)
.github/workflows/site.yml         build → drift check → deploy to GitHub Pages (FR-014/015)
```

- **Brand tokens → Starlight (US-4):** `design-tokens.json` is transcribed to CSS custom properties
  in `tokens.css`; `theme.css` maps them onto Starlight's `--sl-color-*` variables and defines the
  `[data-theme='light'|'dark']` swaps for the `{light,dark}` semantic tokens. Tailwind consumes the
  same tokens via `tailwind.config.mjs` so utilities and Starlight agree (D2). Bright brand hues are
  bound to headings/accents/affordances only; body uses neutral text tokens (ui.md a11y).
- **Diagrams (US-3):** a `Diagram.astro` wrapper renders Mermaid **client-side**, seeding
  `themeVariables` from the `component.mermaid.*` CSS vars and re-initializing on theme change, so a
  single diagram re-themes live in light/dark (FR-007). The wrapper **always** emits the caption +
  text summary in the DOM, so no-JS and render-failure both fall back to readable text (edge cases,
  D1).
- **Phase docs (US-2):** one MDX page per phase using the `PhaseBadge` component and a frontmatter
  contract (`phase`, `command`, `reads`, `writes`, `order`); `content.config.ts` validates it. The
  drift check asserts these against `src/prompts` CommandSpecs.
- **Publish (US-6):** `site.yml` runs on pushes touching `site/**`/`src/prompts/**`: install → run
  `check-docs-sync` → `astro build` → deploy via Pages. Astro `base: '/AmbyKit/'` for project-page
  URLs (D4).

## Phased approach

- **Phase 0 — Research** → `@research.md`: Mermaid theming/no-JS strategy (D1), Tailwind↔Starlight
  reconciliation (D2), FR-014 generate-vs-check (D3 → **CI-check**), Pages deploy + `base` (D4). Done.
- **Phase 1 — Foundational** → `@contracts/docs-sync.md`: scaffold (Setup) + token/theme/Mermaid
  plumbing + header override. Delivers the themed shell every story renders in (FR-001/006/007/008).
- **Phase 2 — US-1:** home + nav verified (build, search, no broken links).
- **Phase 3 — US-2:** phase-doc template + overview + getting-started + 8 phase pages (FR-002/003).
- **Phase 4 — US-3:** `Diagram` wrapper + D1/D2/D3 (FR-004/005).
- **Phase 5 — US-4:** hero gradient + palette applied + logo slot + contrast verify (FR-006/011).
- **Phase 6 — US-5:** CLI reference + compatibility table (FR-012).
- **Phase 7 — US-6:** responsive + a11y + Pages workflow + drift check (FR-009/010/013/014/015).
- **Phase 8 — Polish:** link-check, self-host gate unaffected, reproducible build.

(Task list `@tasks.md` already follows this order; T073 is resolved to the CI-check mechanism below.)

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| US-1 / FR-001 | Standalone Astro Starlight package in `site/`. |
| FR-008 | Starlight sidebar nav + built-in Pagefind search. |
| US-2 / FR-002 | `start/getting-started` MDX chains install → first artifact. |
| US-2 / FR-003 | One MDX page per phase via `PhaseBadge` + frontmatter contract. |
| US-3 / FR-004 | D1 workflow-sequence Mermaid on the overview page. |
| US-3 / FR-005 | `Diagram` wrapper renders D1/D2/D3 with token-driven theming. |
| US-4 / FR-006 | `tokens.css`→Starlight vars + Tailwind theme; hero uses `gradient.brand`. |
| FR-007 | `[data-theme]` swaps `{light,dark}` tokens; Mermaid re-themes on toggle. |
| US-4 / FR-011 | `Logo` component: wordmark placeholder → PNG + favicon when supplied. |
| US-5 / FR-012 | `cli/` reference pages + compatibility table (overflow-scroll). |
| US-6 / FR-009 | Starlight responsive layout; Tailwind reflow; verified 320px→desktop. |
| US-6 / FR-010 | AA contrast; bright hues limited to large text/affordances (ui.md). |
| FR-013 | `astro build` → static `dist/` via a documented `site/` script. |
| FR-014 | `scripts/check-docs-sync.mjs` diffs page facts vs `src/prompts`+registries; CI-gated. |
| FR-015 | `.github/workflows/site.yml` deploys `dist/` to GitHub Pages on default-branch merge. |

Every FR maps to a design element; none is unsatisfiable.

## Risks & decisions

- **Mermaid no-JS vs live theming (D1).** Client-side rendering needs JS; mitigated by always
  emitting the caption/text summary in the DOM (satisfies the no-JS + failure edge cases) and reading
  CSS-var theme so light/dark works. Build-time inline-SVG (rehype-mermaid) was rejected — it needs
  Playwright in CI and bakes one non-theme-switchable SVG (`@research.md` D1).
- **GitHub Pages `base` path (D4).** Wrong `base` breaks internal links/asset URLs on a project page.
  Mitigation: set Astro `site`+`base: '/AmbyKit/'`, rely on Starlight's base-aware links, and verify
  against the built output. If a custom domain is later added, `base` returns to `/`.
- **Tailwind ↔ Starlight CSS conflicts (D2).** Reconciled with `@astrojs/starlight-tailwind`;
  residual specificity clashes are contained by applying brand via Starlight CSS vars, using Tailwind
  mainly for custom components (Hero/cards).
- **FR-014 is a check, not generation (D3).** Prose is hand-authored for quality; the check enforces
  that phase/command **facts** match `src/prompts`+registries. This keeps `src/prompts` the single
  source of truth (Principle 1) without generating awkward prose from prompt bodies. Trade-off:
  wording can still drift within the checked invariants — acceptable, and cheaper than full codegen.
- **Logo pending.** Placeholder wordmark path is specced (ui.md US-4); swapping in the PNG is a
  content change, not a code change.
- **No `plan.md` existed when `@tasks.md` was written.** This plan is consistent with it; the only
  open task decision (T073) is now resolved to the CI-check above — no task renumbering needed.

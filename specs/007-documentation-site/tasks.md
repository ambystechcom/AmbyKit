---
feature: 007-documentation-site
created: 2026-07-07
---

# Tasks — AmbyKit documentation site

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Story graph: US-1→(US-2,US-3,US-4); US-2→US-5; US-4→US-6. Stack is mandated (Astro Starlight +
> Tailwind + Mermaid + GitHub Pages, dir `site/`); brand tokens/diagrams are binding via signed-off
> `@ui.md` + `@design-tokens.json`. Technical approach in `@plan.md`; decisions in `@research.md`;
> FR-014 mechanism resolved to the CI-check in `@contracts/docs-sync.md`.

## Phase 1 — Setup

- [x] [T001] Scaffold an Astro Starlight project in `site/` (site/)
- [x] [T002] [P] Add Tailwind v4 to the Astro build via `@tailwindcss/vite` + starlight-tailwind (site/astro.config.mjs, site/src/styles/global.css)
- [x] [T003] [P] Add Mermaid dependency for the diagram component (site/package.json)
- [x] [T004] Configure site metadata + sidebar nav skeleton (Start / Workflow) (site/astro.config.mjs)
- [x] [T005] [P] Add `site/.gitignore` (node_modules, dist, .astro) + dev/build/preview scripts (site/.gitignore, site/package.json)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Translate `design-tokens.json` → CSS custom properties (primitive + semantic light/dark) (site/src/styles/tokens.css)
- [x] [T011] [P] Map brand tokens onto Starlight theme vars + Tailwind theme colors (site/src/styles/theme.css)
- [x] [T012] Wire light/dark so semantic `{light,dark}` tokens swap with the theme toggle (site/src/styles/tokens.css)
- [x] [T013] Configure the Mermaid theme from `component.mermaid.*`, legible in both modes (site/src/styles/mermaid.ts)
- [x] [T014] Override the Starlight header: branded SiteTitle placeholder + GitHub link (site/src/components/SiteTitle.astro)
- **Checkpoint:** a themed, navigable shell builds and serves. ✓ (`astro build` → 4 pages, Pagefind search, brand tokens shipped)

## Phase 3 — User story US-1 — Navigable site exists  (priority: P1)

- [x] [T020] [US1] Home splash + hero wired into the nav groups (site/src/content/docs/index.mdx)
- [x] [T021] [US1] Verify the build serves a navigable site with search and base-correct internal links (site/)
- **Checkpoint:** US-1 demoable — site builds; nav + search work.

## Phase 4 — User story US-2 — Every process step documented  (priority: P1, depends US-1)

- [x] [T030] [US2] Phase-doc template: `PhaseBadge` + `Artifacts` components (purpose/command/reads/writes) (site/src/components/PhaseBadge.astro, site/src/components/Artifacts.astro)
- [x] [T031] [US2] Workflow overview page (phase index cards + intro) (site/src/content/docs/workflow/index.mdx)
- [x] [T032] [P] [US2] Getting-started page: install → first artifact (SC-001) (site/src/content/docs/start/getting-started.mdx)
- [x] [T033] [US2] Author the 8 phase pages (constitution…implement) with phase frontmatter facts (site/src/content/docs/workflow/*.mdx)
- [x] [T034] [US2] Verify all 8 phases have one page; Starlight pagination chains in order; links base-correct (SC-002/003) (site/)
- **Checkpoint:** US-2 demoable — full process documented.

## Phase 5 — User story US-3 — Mermaid diagrams  (priority: P1, depends US-1)

- [x] [T040] [P] [US3] `Diagram` wrapper: Mermaid + caption + text-summary fallback, re-themes on toggle (site/src/components/Diagram.astro)
- [x] [T041] [US3] D1 workflow-sequence diagram on the overview page (site/src/content/docs/workflow/index.mdx)
- [x] [T042] [P] [US3] D2 author-once/emit-per-tool diagram on the architecture page (site/src/content/docs/concepts/architecture.mdx)
- [x] [T043] [P] [US3] D3 story dependency-graph diagram on the analyze page (site/src/content/docs/workflow/analyze.mdx)
- [x] [T044] [US3] Verify diagrams render + fallback text in static HTML (SC-005); live theming via CSS-var themeVariables (site/)
- **Checkpoint:** US-3 demoable — diagrams live.

## Phase 6 — User story US-4 — ambystech brand  (priority: P2, depends US-1)

- [x] [T050] [US4] Home hero: signature gradient panel + Deep scrim for AA white text; solid fallback (site/src/styles/brand.css)
- [x] [T051] [P] [US4] Apply palette across links/active-nav/footer hairline; brand tokens on Starlight vars (site/src/styles/brand.css, theme.css)
- [x] [T052] [P] [US4] Header logo: real AmbyKit lockup (Starlight `logo`, replacesTitle), downscaled 2.2MB→11KB; gradient favicon (site/src/assets/ambykit_logo.png, site/public/favicon.svg)
- [x] [T053] [US4] Verify palette + gradient in bundle; hero scrim (45→75% Deep) sizes white text to AA (SC-004) (site/)
- **Checkpoint:** US-4 demoable — on-brand in light + dark.

## Phase 7 — User story US-5 — CLI & compatibility reference  (priority: P2, depends US-2)

- [x] [T060] [US5] CLI reference page: one entry per verb (usage/flags/examples) for all 7 verbs (site/src/content/docs/cli/index.mdx)
- [x] [T061] [P] [US5] Tool-compatibility page: targets + surface + file matrix (site/src/content/docs/cli/compatibility.mdx)
- [x] [T062] [US5] Verify all 7 verbs on the reference page; every non-alias target listed (SC-007) (site/)
- **Checkpoint:** US-5 demoable — reference on the site.

## Phase 8 — User story US-6 — Responsive, accessible & published  (priority: P3, depends US-4)

- [x] [T070] [US6] Responsive: Starlight layout + diagram/table `overflow-x` containers (no page overflow) (site/src/components/Diagram.astro, brand.css)
- [x] [T071] [US6] Accessibility: focus rings, Starlight skip-link/landmarks, neutral-token AA text, diagram text fallbacks (site/src/styles/theme.css)
- [x] [T072] [US6] GitHub Actions: docs-sync → build → deploy `site/` to GitHub Pages on default-branch merge (FR-015) (.github/workflows/site.yml)
- [x] [T073] [US6] Docs-sync check per `@contracts/docs-sync.md` (A1–A5) + happy-path test; proven to catch drift; runs in CI before build (FR-014) (scripts/check-docs-sync.mjs, test/check-docs-sync.test.ts)
- [x] [T074] [US6] Verify docs-sync check + site build pass (deploy runs on push to Pages) (site/, .github/)
- **Checkpoint:** US-6 demoable — responsive, accessible, published.

## Phase 9 — Polish

- [x] [T090] Clean build (15 pages, base-correct links); linked the site from the root `README.md` (README.md)
- [x] [T091] Confirmed `ambykit sync --check` stays green + root typecheck/tests pass — CLI package untouched (Principle 6/7)
- [x] [T092] Documented the build/publish command; site builds reproducibly (site/README.md)

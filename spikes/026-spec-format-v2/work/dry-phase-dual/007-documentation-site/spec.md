---
feature: 007-documentation-site
title: AmbyKit documentation site
branch: 007-documentation-site
status: done
created: 2026-07-07
---

# Spec — AmbyKit documentation site

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit's guidance today lives in scattered `docs/*.md` and README files. New users have no single,
navigable, branded place that explains **what AmbyKit is** and **how each step of its Spec-Driven
Development (SDD) workflow works**. This feature delivers a documentation website — living in a
top-level `site/` directory — that onboards a new user, documents every workflow phase with visual
diagrams, and presents the ambystech brand.

> The requestor mandated the delivery stack (framework, styling, diagram tooling). Those are HOW
> choices recorded under **Assumptions** and validated in `plan.md`; the stories/requirements below
> stay tech-agnostic so they remain testable against the outcome, not the tooling.

## User scenarios & testing

### US-1 — A navigable documentation site exists  (priority: P1)

As a developer evaluating AmbyKit, I want a documentation website I can browse, so that I have one
authoritative place to learn the tool.

- **Why this priority:** Foundational — every other story renders inside this site; nothing is
  demoable until the site builds and serves pages.
- **Independent test:** Build and serve the site from `site/`; confirm a home page plus at least one
  content page load, with working navigation and search.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the site source in `site/`, When it is built, Then it produces a browsable site with a home
  page, a navigation sidebar, and site-wide search.
- Given any page, When a user follows an internal link, Then it resolves (no broken internal links).

### US-2 — Every step of the AmbyKit process is documented  (priority: P1)

As a developer adopting AmbyKit, I want each phase of the SDD workflow documented, so that I know
what each phase produces and the order to run them in.

- **Why this priority:** The core value of the site — explaining the process is the whole point of
  the request.
- **Independent test:** Confirm a dedicated page exists for each phase (constitution, specify,
  clarify, design, plan, tasks, analyze, implement) plus a workflow overview, each stating the
  phase's purpose, inputs, outputs, and the command that runs it.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the docs, When a user opens a phase page, Then it describes that phase's purpose, the
  artifact(s) it reads and writes, and how to invoke it.
- Given a first-time reader, When they follow a getting-started path, Then it takes them from install
  to producing their first artifact.
- Given the set of phases, When the docs are reviewed, Then every phase in the AmbyKit workflow has
  exactly one dedicated page and none is missing.

### US-3 — Visual diagrams explain the workflow and architecture  (priority: P1)

As a visual learner, I want diagrams of the workflow sequence, the author-once/emit-per-tool
architecture, and the story dependency graph, so that I can grasp the concepts quickly.

- **Why this priority:** Explicitly requested and materially improves comprehension of the process
  (US-2) and architecture; ships alongside the content it clarifies.
- **Independent test:** Confirm the workflow-sequence, architecture, and dependency-graph concepts
  each render as a diagram on the relevant page.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a concept better shown than told (workflow order, author-once/emit-per-tool, story graph),
  When its page renders, Then a diagram is present and legible.
- Given a diagram, When the page is viewed in light or dark mode, Then the diagram remains legible in
  both.

### US-4 — The site reflects the ambystech brand  (priority: P2)

As a visitor, I want the site to use the ambystech brand palette, signature gradient, and logo, so
that it feels cohesive and professional.

- **Why this priority:** Strongly desired for credibility, but the content (US-2/US-3) delivers the
  primary value; branding can layer on afterward.
- **Independent test:** Confirm the brand palette and the signature gradient appear across the site
  and that theming is consistent in light and dark modes.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given any page, When it renders, Then it uses the ambystech palette — primary `#EE1199`, Bluetiful
  `#3C69E7`, Dark Orchid `#9932CC`, Vivid Sky Blue `#00CCFF`, Deep `#040D14`.
- Given a branded surface (e.g. hero/header/accents), When it renders, Then the signature gradient
  `#EE1199 → #9932CC → #00CCFF` is used.
- Given the logo asset, When it is available, Then it appears in the site header and as the favicon;
  until it is provided, a placeholder mark is shown without breaking layout. The logo will be
  delivered as a PNG. Proposed assets: a square source PNG (≥ 512×512) for the mark/favicon (derived
  at 16/32/48/180 px), and — if available — a horizontal lockup for the header (displayed at ~32 px
  height, supplied at ~2× for retina).

### US-5 — CLI and tool-compatibility reference is on the site  (priority: P2)

As a developer using AmbyKit day to day, I want the command reference and the tool-compatibility
matrix on the site, so that I can look them up without leaving the docs.

- **Why this priority:** High utility for active users, but secondary to explaining the process to
  newcomers.
- **Independent test:** Confirm the site includes a command reference (every CLI verb) and the
  supported-tools/compatibility matrix.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the docs, When a user searches a command name, Then the reference page for it is found.
- Given the tool-compatibility page, When it renders, Then every supported assistant and its command
  surface is listed.

### US-6 — The site is responsive, accessible, and publishable  (priority: P3)

As any reader (including mobile and low-vision users), I want the site to be responsive, accessible,
and continuously published, so that I can read current docs anywhere.

- **Why this priority:** Quality and reach matter but come after the content exists and is branded.
- **Independent test:** View the site from a narrow (≈320px) to a desktop viewport with no horizontal
  overflow; verify AA contrast; confirm a documented build/publish path keeps the site current.
- **depends-on:** [US-4]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given viewport widths from ≈320px to desktop, When any page renders, Then there is no horizontal
  scrolling and content reflows.
- Given text and UI elements, When measured, Then contrast meets WCAG AA (≥ 4.5:1 text, ≥ 3:1 large
  text/affordances) — including brand colors on the Deep background.
- Given a change merged to the default branch, When the GitHub Actions deploy workflow runs, Then the
  built site is published to the repository's GitHub Pages. (npm-package deployment is a separate
  future feature and is out of scope here.)

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL provide a documentation website whose source lives in a top-level `site/`
  directory.
- FR-002  THE SYSTEM SHALL provide a getting-started path that takes a new user from installation to
  producing their first AmbyKit artifact.
- FR-003  THE SYSTEM SHALL document each AmbyKit workflow phase — constitution, specify, clarify,
  design, plan, tasks, analyze, implement — on its own page stating the phase's purpose, the
  artifacts it reads/writes, and how to invoke it.
- FR-004  THE SYSTEM SHALL present a visual overview of the end-to-end workflow sequence.
- FR-005  WHERE a concept is clearer shown than told (workflow order, author-once/emit-per-tool
  architecture, story dependency graph), THE SYSTEM SHALL include a diagram.
- FR-006  THE SYSTEM SHALL apply the ambystech palette (primary `#EE1199`, `#3C69E7`, `#9932CC`,
  `#00CCFF`, Deep `#040D14`) and the signature gradient (`#EE1199 → #9932CC → #00CCFF`) consistently.
- FR-007  THE SYSTEM SHALL support both light and dark presentation, keeping content and diagrams
  legible in each.
- FR-008  THE SYSTEM SHALL provide site navigation and full-text search across the documentation.
- FR-009  WHEN rendered at viewport widths from ≈320px to desktop, THE SYSTEM SHALL reflow content
  without horizontal overflow.
- FR-010  THE SYSTEM SHALL meet WCAG AA contrast for text and interactive elements.
- FR-011  WHERE the project logo asset is available, THE SYSTEM SHALL display it in the site header
  and as the favicon.
- FR-012  THE SYSTEM SHALL surface the CLI command reference and the tool-compatibility matrix.
- FR-013  THE SYSTEM SHALL build into publishable static output via a single documented command.
- FR-014  THE SYSTEM SHALL keep the site's workflow/command **facts** in sync with the AmbyKit source
  of truth (the `src/prompts` CommandSpecs plus the CLI-verb and emitter/target registries), enforced
  by a CI check that fails the build on drift (Principle 1, Principle 6). Prose is hand-authored; the
  checked invariants are defined in `contracts/docs-sync.md`. (Scope resolved 2026-07-07: the check
  covers workflow/command facts, not prose-parity with `docs/`.)
- FR-015  WHEN a change is merged to the default branch, THE SYSTEM SHALL publish the built site to
  the repository's GitHub Pages via a GitHub Actions workflow.

## Success criteria

- SC-001  Following the getting-started path, a new user reaches their first produced artifact in
  ≤ 10 minutes.
- SC-002  100% of AmbyKit workflow phases (8) have a dedicated documented page; zero missing.
- SC-003  The site builds with zero broken internal links.
- SC-004  The brand palette and signature gradient are present, and all text meets WCAG AA contrast.
- SC-005  The workflow-sequence, architecture, and dependency-graph concepts each have a rendered
  diagram.
- SC-006  Every page renders without horizontal scroll from 320px width to desktop.
- SC-007  Site search returns the correct reference page for each phase/command name.

## Edge cases

- JavaScript disabled — search and diagrams should degrade to a usable state (e.g. static content
  still readable).
- Diagram fails to render — a text description or fallback remains.
- Logo not yet provided — a placeholder mark is shown without breaking layout.
- Very long code blocks / wide tables — scroll within their container, not the page.
- Print / reader mode — content remains legible.
- Brand colors on the Deep background — must not fall below AA contrast for body text.

## Assumptions

- **Mandated delivery stack (HOW, recorded here, validated in `plan.md`):** the site is built with
  Astro Starlight, styled with Tailwind, and renders diagrams with Mermaid, in a `site/` directory.
  These are requestor constraints, not choices this spec makes.
- Logo assets will be supplied later; a placeholder is used until then (see US-4 clarification).
- The new `site/` **complements** and does not replace `docs/`: `docs/` remains the contributor / AI-
  agent guidance for people (and agents) working **on** the AmbyKit project, while `site/` is the
  user-facing product documentation. Both are kept in sync from the shared source of truth (FR-014).
- The eight phases named in FR-003 are the current AmbyKit workflow; if the workflow gains/loses a
  phase, the docs set changes with it (ties to FR-014).

# Research — Continue-spec (`/amby.revise`) Phase 0 decisions

Decisions with rationale. Feeds `plan.md`; referenced by ID from tasks.

## R-1 — Does FR-005 need a dashboard code change? No.

**Question:** the spec deferred to planning whether the dashboard needs a change to reflect
in-progress vs done after a continue (FR-005/US-3).

**Finding:** `computeDashboard` (`src/core/dashboard.ts`) parses each story's `**status:**` line
directly (`parseStories`, lines 97-98) into `StoryProgress.status`, and the status vocabulary already
includes `in-progress`. The feature-006 `status-badge` tokens already define an `in-progress` color.
So the dashboard renders whatever status the artifacts declare — including `in-progress` a continue
would set — with no code change.

**Decision:** FR-005 requires **no dashboard code change**. It is satisfied by `/amby.revise` writing
correct statuses (FR-004) plus a verification test (US-3 phase). The dashboard is story-centric, so it
reflects **story** `**status:**` values; the feature-level `spec.md` frontmatter status set by FR-004
is not shown by the dashboard, which is fine — the visible progress is per-story + task %.

## R-2 — Phase ordering and docs-sync placement

**Constraints:** `PHASE_SEQUENCE` (`src/core/rules.ts`) orders the workflow-command table in the
emitted `AGENTS.md`. The docs-sync check (`scripts/check-docs-sync.mjs`) requires A1: exactly one site
workflow page per CommandSpec `id`, and A3: page `order` values form a contiguous `1..N`.

**Decision:** place `revise` **after `clarify`** — it is a specify-phase continuation. Add `"revise"`
to `PHASE_SEQUENCE` after `"clarify"`, and insert `site/src/content/docs/workflow/revise.mdx` with
`order` after clarify's, renumbering design→implement by +1 to keep A3 contiguous. Mechanical; keeps
the sidebar in true workflow order rather than appending `revise` at the end.

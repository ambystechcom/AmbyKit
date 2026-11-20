---
feature: 032-dashboard-redesign-and-metrics
created: 2026-11-20
---

# Research — Dashboard redesign and workflow metrics

> Inventory for T001 (cite as `032:research`). Facts read from main at 1.6.0 plus 030 and 031 as merged.

## Hosted views

| Tab | View today | Source | Loaded by one-shot / `--json`? |
|---|---|---|---|
| overview | overview + feature + story detail | `src/cli/ui/dashboard/render-overview.ts`, `story-detail.ts` | yes (the one-shot render path) |
| graph | dependency graph (`g`) | `src/cli/ui/dashboard/graph-view.ts` | no: dynamic import in `dashboard.ts` `interactive()` (023 FR-015) |
| fleet | Fleet view (`l`) | `src/cli/ui/dashboard/fleet-view.ts`, `src/core/fleet-view/*` | no: dynamic import in `interactive()` (029 FR-012) |
| quality | coverage and findings (`c`) | `src/cli/ui/dashboard/quality-view.ts` | imported by `overview.ts`, which is an interactive-only module |
| (new) metrics | none yet | `src/core/metrics/*` (this feature) | no: read after the first paint, interactive only |

Existing reducer keys (`overview.ts`): `tab`/`shift-tab` move panel focus in the overview, `f` filters by feature text, `s`
cycles the status filter, `esc` clears, `g` graph, `l` fleet, `c` quality, `?` help, `q` quit.

## Contracts used from other specs

- **030** (merged): `readSpec(feature, text)` and `readTasks(text)` in `src/core/spec-format/dispatch.ts` decide the format
  per file from its content. Every historical revision is parsed through them (026:D-9, 032:FR-019).
- **031** (merged): the cross-feature grouping is `fleetsView(root, now)` in `src/core/fleet/fleet-view.ts`
  (`FleetsEntry.features[].lanes`). Phase 11 groups the Fleet tab with it (T052).
- **029** (merged): `runView`/`fleetJson` in `src/core/fleet-view/*`, `FLEET_KEYS`, the icon tokens and `dashboard.icons`.
- **burndown**: `parseCatFileBatch`, `git`, `gitWithInput` (`src/core/burndown.ts`, `src/core/git.ts`) are reused by the
  metrics history reader.

## Decisions taken while building

- Tab switching keys are `1`-`4` and `]`/`[`; `tab`/`shift-tab` keep moving panel focus inside the overview (existing
  tests and behaviour). See the DEVIATION on T030.
- A converge run is a tasks.md revision that adds task lines closing a requirement (`(closes FR-###` or `(closes SC-###`),
  which is what `/amby.converge` appends under `## Convergence`; the gap count is how many it added.

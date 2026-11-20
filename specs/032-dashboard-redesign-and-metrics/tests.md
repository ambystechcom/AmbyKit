---
feature: 032-dashboard-redesign-and-metrics
created: 2026-11-19
---

# Tests — Dashboard redesign and workflow metrics

> Test design, written by `/amby.tasks` before code. One case per acceptance criterion; machine-read by `ambykit analyze`.
> Case: `- [TC-###] [US-n#k] [FR-###, FR-###] auto — short name → expected outcome`
> `US-n#k` = the k-th acceptance bullet of story n. `TC-###` = highest + 1, never reused or renumbered.
> Name tests in code `032:FR-###: …` (qualified).

## Cases

- [TC-001] [US-1#1] [FR-001] auto — open the interactive dashboard → overview tab active and the tab list shows all four with the active one marked
- [TC-002] [US-1#2] [FR-001, FR-003] auto — select each tab → only that tab's content renders
- [TC-003] [US-1#3] [FR-002] auto — select fleet and graph tabs in a project with no run and no graph data → each says so and how to get data
- [TC-004] [US-1#4] [FR-003] auto — render each existing panel inside its tab → content equals the 1.6.0 rendering
- [TC-005] [US-1#5] [FR-018] auto — two features' lanes in the fleet tab → grouped by feature across features
- [TC-006] [US-2#1] [FR-004] auto — keys only: switch tab, move, open and close detail, quit → each works
- [TC-007] [US-2#2] [FR-004] auto — ask for help on any screen → the keys are listed
- [TC-008] [US-2#3] [FR-004] auto — press a key with no meaning → state unchanged, no error
- [TC-009] [US-2#4] [FR-005] auto — quit, interrupt and error exits → terminal restored in each
- [TC-010] [US-3#1] [FR-006] auto — search by text and by ID → only matches show and the match is clear
- [TC-011] [US-3#2] [FR-006] auto — filter by blocked, in progress, done → only that state shows, filter visible
- [TC-012] [US-3#3] [FR-006] auto — filter matching nothing → says so and how to clear
- [TC-013] [US-3#4] [FR-006] auto — clear a search or filter → the full list returns
- [TC-014] [US-4#1] [FR-007, FR-019] auto — history of several features, v1 and mixed → cycle time per feature and a typical value, same for both formats
- [TC-015] [US-4#2] [FR-007] auto — history with converge runs → gap rate per run shown as a trend
- [TC-016] [US-4#3] [FR-008] auto — little or no history → "not enough data", no numbers
- [TC-017] [US-4#4] [FR-016] auto — compute metrics with network and model calls trapped → none occur
- [TC-018] [US-4#5] [FR-007, FR-011] auto — large history in the interactive dashboard → first paint is not blocked, metrics arrive later
- [TC-019] [US-5#1] [FR-009, FR-020] auto — one-shot and `--json` on the largest fixture with the 030 reader → under 1 s
- [TC-020] [US-5#2] [FR-010] auto — `--json` field set against the recorded baseline → existing fields unchanged, only additions
- [TC-021] [US-5#3] [FR-011] auto — one-shot and `--json` import graph → metrics and graph views not loaded
- [TC-022] [US-5#4] [FR-017] auto — existing non-interactive commands' output → unchanged
- [TC-023] [US-6#1] [FR-012] auto — narrow terminal → tabs and content adapt with nothing cut off
- [TC-024] [US-6#2] [FR-012] auto — no color and no icons → every state distinguishable by text
- [TC-025] [US-6#3] [FR-013] auto — each icon mode and the setting precedence → new tabs, states and lanes use the same tokens
- [TC-026] [US-6#4] [FR-014] auto — resize → redraws to fit
- [TC-027] [US-6#5] [FR-014] auto — piped output → plain fallback
- [TC-028] [US-7#1] [FR-015] manual:human-judgment — layout and tokens come from the signed-off design → signed-off design is used; verify: `ui.md` has `signed_off` and the tokens file matches the renderer; record: specs/032-dashboard-redesign-and-metrics/research.md
- [TC-029] [US-7#2] [FR-015] manual:visual-check — spacing, headings, colors and states across the four tabs → consistent across tabs; verify: the dogfood tour (T113); record: specs/032-dashboard-redesign-and-metrics/research.md
- [TC-030] [US-7#3] [FR-015] auto — a state in any tab → renders identically everywhere

## Uncovered

- FR-016 beyond the no-network and no-model guard in TC-017: the whole-tool guarantee is covered by 028's and 029's guards; this feature adds only the metrics path.

## Flags

- US-6#1: "narrow" has no stated width → the plan reuses 029's compact breakpoint; settle it in the design.

---
feature: 006-enhanced-tui
status: draft
created: 2026-07-07
---

# Implementation Plan — Enhanced terminal UI for the AmbyKit CLI

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> References spec by ID — see `@spec.md` for the WHAT/WHY. Dependency rationale in `@research.md`;
> module interfaces in `@contracts/ui.md`; value objects in `@data-model.md`.

## Technical context

- **Stack:** Node ≥ 20, TypeScript ES2022, NodeNext ESM (`.js` import specifiers). No change to
  toolchain.
- **Key libraries:** **Zero new runtime dependencies (primary path).** A small internal rendering
  layer built on Node built-ins — `node:tty`, `node:readline`, `node:util`, `node:process` —
  supplies color, symbols, spinner, progress, responsive tables, full-screen view, and prompts.
  `picocolors` is the **only** pre-approved fallback (tiny, zero-dep) *if* hand-rolled ANSI proves
  unmaintainable — see `@research.md` D1. This uses 0 of the SC-006 budget of ≤ 3 small deps.
- **Constraints driving choices:**
  - **Principle 3 (frugality):** hand-rolled zero-dep layer over pulling `ink`/`blessed`/`ora`,
    whose transitive footprint would blow SC-006 (`@research.md` D1–D3).
  - **Principle 2 (subclass, don't duplicate):** one shared UI layer behind `BaseCommand`; commands
    never style output directly (FR-001).
  - **Principle 7 (least surprise / least privilege):** rendering writes nothing to disk (FR-011);
    color/interactivity gate on TTY capability (FR-002/003/014/016); `--json` stays byte-plain
    (FR-009/010).
  - **Principle 5 (testing):** IO is split from pure logic (layout, table fitting, prompt/menu
    reducers) so each FR maps to a unit or snapshot test.

## Architecture

A new `src/cli/ui/` module is the single rendering surface. `BaseCommand`'s
`info/success/warn/error` (and `banner.ts`, dashboard `formatTable`) delegate to it; no command
emits ANSI on its own.

```
src/cli/ui/
  capabilities.ts   detect TTY, NO_COLOR, color depth, columns, unicode → Capabilities (one source)
  theme.ts          palette + Symbols (unicode set + ASCII fallback set), heading/label styles
  render.ts         message renderers (info/success/warn/error/heading); pure string in/out
  progress.ts       spinner + step feedback + ChangeSummary formatter (consumes WriteResult)
  table.ts          responsive table: width-aware truncate/drop-column + progress-bar cell
  interactive/
    fullscreen.ts   alt-screen host: raw mode, keypress loop, guaranteed terminal restore
    dashboard.ts    navigable dashboard view (pure reducer + fullscreen host) — US-6
    prompt.ts       multi-select prompt (pure reducer + readline keypress) — US-7
```

- **Capability detection is centralized** (`capabilities.ts`): every gate (color on/off, glyph vs
  ASCII, table width, TTY-only interactivity) reads one `Capabilities` object so behavior is
  consistent and testable by injection (FR-002/003/007/012). `banner.ts`'s ad-hoc `useColor()` is
  absorbed here.
- **Pure/IO split:** `render.ts`, `table.ts`, and the interactive **reducers** are pure functions
  (state + input → next state / string). Only `fullscreen.ts`, `prompt.ts`, and command edges touch
  stdin/stdout. Keeps `src/core`-style purity at the `cli` edge (repo convention; Principle 5).
- **Change summaries are free:** `WriteResult { written, unchanged, wouldChange, skipped }`
  (`src/cli/fsops.ts`) already carries everything US-3 needs; `progress.ts` just formats it. `sync`
  already computes it; `init`/`add`/`upgrade` route their existing results through the same
  formatter (FR-006).
- **Machine output untouched:** `--json` paths call `this.info(JSON.stringify(...))`; `info()` is a
  plain passthrough (only `success/warn/error/heading` add glyphs), so JSON and other `--json`
  contracts stay byte-identical (FR-009/010, SC-004).

## Phased approach

- **Phase 0 — Research** → `@research.md`: dependency decision (hand-roll vs `picocolors` vs
  `ink`/`blessed`/`ora`/`@inquirer`), capability-detection strategy (color, unicode, width), and
  terminal-restore approach for the full-screen view. **Done.**
- **Phase 1 — Foundation** → `@data-model.md`, `@contracts/ui.md`: build `capabilities.ts`,
  `theme.ts`, `render.ts`; refactor `BaseCommand` + `banner.ts` to delegate. Satisfies US-1 and the
  cross-cutting gates (FR-001/002/003/008/011). Establishes the interfaces every later phase uses.
- **Phase 2 — US-2 (P1):** responsive `table.ts` with a progress-bar cell + status styling; swap
  dashboard's `formatTable`. FR-004/007. `--json` dashboard path stays plain.
- **Phase 3 — US-3 (P2):** `progress.ts` spinner/step feedback + `ChangeSummary` formatter wired
  into `init`/`add`/`sync`/`upgrade`; `--dry-run` wording reflects "would" (FR-005/006).
- **Phase 4 — US-4 (P2):** degradation hardening + tests — non-TTY strips ANSI, `NO_COLOR`, narrow
  width, and ASCII glyph fallback (FR-002/003/007/012, SC-002). Mostly exercising Phase 1 gates.
- **Phase 5 — US-5 (P3):** distinct error/warning treatment + actionable next-step lines (FR-008).
- **Phase 6 — US-6 (P3):** interactive full-screen dashboard (`fullscreen.ts` + `dashboard.ts`);
  TTY-gated fallback to one-shot (FR-013/014). **Needs a UI design first — see Risks.**
- **Phase 7 — US-7 (P3):** interactive multi-select prompt for `init`/`add`; flags win, non-TTY
  errors with guidance instead of blocking (FR-015/016).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| US-1 / FR-001 | Single `ui/` layer behind `BaseCommand`; all message kinds route through `render.ts` (Principle 2). |
| US-2 / FR-004 | `table.ts` progress-bar cell + status styling in dashboard rows. |
| US-3 / FR-005 | `progress.ts` spinner/step feedback during multi-step commands. |
| US-3 / FR-006 | `ChangeSummary` formatter over existing `WriteResult` for init/add/sync/upgrade. |
| US-4 / FR-002 | `capabilities.ts` reports non-TTY → `render.ts` emits no ANSI. |
| US-4 / FR-003 | `NO_COLOR` detected centrally → color disabled. |
| US-4,US-2 / FR-007 | `table.ts` fits to `Capabilities.columns` (truncate/drop) without misalignment. |
| US-4 / FR-012 | `theme.ts` swaps to ASCII `Symbols` when `Capabilities.unicode` is false. |
| US-5 / FR-008 | Distinct error/warn styles + next-step message convention in `render.ts`. |
| — / FR-009 | `--json`/machine output bypasses styling (plain `info` passthrough). |
| — / FR-010 | No exit-code or `--json` contract changes; regression test asserts byte-identical JSON (SC-004). |
| — / FR-011 | Rendering never writes files; reuses read-only `Capabilities`. |
| US-6 / FR-013 | `fullscreen.ts` alt-screen + keypress loop with guaranteed restore. |
| US-6 / FR-014 | Interactive dashboard gates on TTY; falls back to one-shot otherwise. |
| US-7 / FR-015 | `prompt.ts` prompts only when a required selection is absent; flags suppress it. |
| US-7 / FR-016 | Non-TTY + missing selection → error with guidance, never blocks. |

Every FR maps to a design element; none is unsatisfiable. Test hooks per FR are in `@contracts/ui.md`.

## Risks & decisions

- **Full-screen TUI needs a UI design; `ui.md` is absent.** US-6 (and the US-7 prompt layout) have
  no wireframes. **Recommendation:** run `/amby.design` for feature 006 before Phase 6/7; Phases 0–5
  do not depend on it. Flagged as a gap, not a blocker for the P1/P2 work.
- **Hand-rolled full-screen correctness** (raw mode, `SIGINT`, resize, restore). Mitigation:
  `fullscreen.ts` centralizes enter/exit with `try/finally` + signal handlers restoring the normal
  screen buffer and cooked mode; TTY-gated (FR-014). See `@research.md` D3.
- **Unicode/color capability is heuristic** — no reliable terminal query. Mitigation: conservative
  env-based detection (`NO_COLOR`, `TERM`, `WT_SESSION`, locale) with room for an explicit override;
  default to the safe (ASCII/no-color) side. See `@research.md` D2.
- **`node:util.styleText` is unstable across Node 20.x**, so color is hand-rolled ANSI (as
  `banner.ts` already does), not built on `styleText`. Decision D1 in `@research.md`.
- **SC-004 (byte-identical `--json`)** guarded by keeping `info()` a plain passthrough and adding a
  before/after regression test on `dashboard --json`.

---
feature: 006-enhanced-tui
kind: research
created: 2026-07-07
---

# Research — Enhanced terminal UI

Decisions for `@plan.md`. Constraint anchor: **SC-006** (≤ 3 new small direct deps, offline at
runtime) and **Principle 3** (frugality). Original ask: "analyze if we need a dependency for the TUI."

## D1 — Color & basic styling: hand-rolled ANSI (no dependency)

| Option | Footprint | Verdict |
|---|---|---|
| **Hand-rolled ANSI** (chosen) | 0 deps | `banner.ts` already does this; centralize in `theme.ts`. Full control of ASCII fallback. |
| `node:util.styleText` | 0 deps | Rejected: added v20.12, unstable across the supported v20.0+ range — can't rely on it. |
| `picocolors` | 1 dep, 0 transitive, ~7 KB | **Pre-approved fallback only.** Cleaner API if hand-rolling grows unwieldy; still fits SC-006. |
| `chalk` | pulls transitive deps, larger | Rejected: heavier than picocolors for no gain here. |

**Decision:** hand-roll ANSI in `theme.ts`; permit `picocolors` as the sole fallback if needed.

## D2 — Capability detection: env heuristics, centralized

No portable runtime query exists for color depth / unicode. Detect once in `capabilities.ts`:

- **TTY:** `process.stdout.isTTY` (drives FR-002 and all interactivity gates).
- **Color off:** not a TTY, or `NO_COLOR` set, or `TERM=dumb` (FR-003).
- **Width:** `process.stdout.columns` with a sane default (e.g. 80) when undefined (FR-007).
- **Unicode:** heuristic — `WT_SESSION`/modern terminal signals + UTF-8 locale
  (`LANG`/`LC_ALL`/`LC_CTYPE`); default to **ASCII** when unknown (FR-012, fail safe).

**Decision:** one injectable `Capabilities` object; every gate reads it (testable via injection).

## D3 — Full-screen interactive dashboard (US-6): hand-rolled alt-screen

| Option | Footprint | Verdict |
|---|---|---|
| **Hand-rolled** `node:readline` + ANSI alt-screen (chosen) | 0 deps | Fits our needs (list nav + detail + quit); full control of restore. |
| `ink` | React + reconciler + many transitive deps | Rejected: **blows SC-006** by a wide margin. |
| `blessed` / `neo-blessed` | large, effectively unmaintained | Rejected: footprint + maintenance risk (Principle 4/7). |

**Decision:** `fullscreen.ts` enters the alternate screen buffer (`\x1b[?1049h`) + raw mode via
`readline.emitKeypressEvents`, and **guarantees restore** (`\x1b[?1049l`, cooked mode) in a
`finally` plus `SIGINT`/`SIGTERM` handlers. `dashboard.ts` keeps state in a **pure reducer**
(`state, key → state`) so navigation is unit-testable without a PTY.

## D4 — Interactive prompts for init/add (US-7): hand-rolled multi-select

| Option | Footprint | Verdict |
|---|---|---|
| **Hand-rolled** readline keypress multi-select (chosen) | 0 deps | Reuses `fullscreen.ts` primitives; one small pure reducer. |
| `@inquirer/prompts` | several transitive deps | Rejected for now: exceeds the frugal path; reconsider only if hand-rolled UX is insufficient. |
| `@clack/prompts` | few deps, nice UX | Fallback candidate within SC-006 if we later want polish. |

**Decision:** hand-roll a minimal multi-select sharing `interactive/` primitives; flags always
suppress the prompt; non-TTY errors with guidance (FR-016).

## Net answer to the original question

**No runtime dependency is required.** The frugal, Principle-3-aligned path is a zero-dep internal
`ui/` layer on Node built-ins. The SC-006 budget (≤ 3 small deps) stays **unspent**, reserved as an
escape hatch: `picocolors` (color) or `@clack/prompts` (prompts) may be adopted later without a spec
change if hand-rolling proves not worth the maintenance.

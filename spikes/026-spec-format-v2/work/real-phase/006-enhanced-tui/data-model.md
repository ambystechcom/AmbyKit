---
feature: 006-enhanced-tui
kind: data-model
created: 2026-07-07
---

# Data model — Enhanced terminal UI

Value objects for the `ui/` layer. All are plain, immutable, and IO-free (Principle 5). Interfaces
in `@contracts/ui.md`.

## Capabilities  (`capabilities.ts`)

Single source of terminal truth; injected everywhere so behavior is deterministic in tests.

| Field | Type | Meaning |
|---|---|---|
| `isTTY` | boolean | stdout is an interactive terminal. Gate for color + interactivity. |
| `color` | boolean | color allowed: `isTTY && !NO_COLOR && TERM≠dumb`. |
| `unicode` | boolean | extended glyphs safe; false → ASCII symbol set (FR-012). |
| `columns` | number | terminal width; default 80 when unknown (FR-007). |

- **Invariant:** `color === false` and `unicode === false` whenever `isTTY === false` (fail safe).

## Symbols / Theme  (`theme.ts`)

Two symbol sets (unicode + ASCII) selected by `Capabilities.unicode`; palette applied only when
`Capabilities.color`.

| Symbol | Unicode | ASCII |
|---|---|---|
| success | ✓ | `[ok]` |
| warn | ! | `!` |
| error | ✗ | `x` |
| bar-fill / bar-empty | █ / ░ | `#` / `-` |
| selected / cursor | ◉ / ▸ | `(*)` / `>` |

## ChangeSummary  (`progress.ts`)

Projection of `WriteResult` (`src/cli/fsops.ts`) — no new data, just a view for FR-006.

| Field | Source | Rendered |
|---|---|---|
| `created` | `written` (new) | green count + list under `--verbose` |
| `updated` | `written`/`wouldChange` | count |
| `unchanged` | `unchanged` | dim count |
| `skipped` | `skipped` | warn count (user-scope files) |
| `dryRun` | command flag | header uses "would" wording |

## TableModel  (`table.ts`)

| Field | Type | Notes |
|---|---|---|
| `columns` | `{ header, min, priority }[]` | `priority` decides drop order when width is tight (FR-007). |
| `rows` | `Cell[][]` | a cell may be text or a `ProgressCell { done, total }` → bar. |
| `width` | number | from `Capabilities.columns`. |

- **Invariant:** rendered rows never exceed `width`; lowest-priority columns drop before any column
  wraps or misaligns.

## MenuState  (`interactive/` reducers, US-6/US-7)

| Field | Type | Notes |
|---|---|---|
| `items` | `T[]` | stories (dashboard) or tool options (prompt). |
| `cursor` | number | highlighted index. |
| `selected` | `Set<number>` | multi-select only (US-7). |
| `mode` | `'list' \| 'detail' \| 'done'` | dashboard drill-in / exit. |

- Pure reducer `(state, key) → state`; IO host renders `state` and reads keys. Unit-testable without
  a PTY.

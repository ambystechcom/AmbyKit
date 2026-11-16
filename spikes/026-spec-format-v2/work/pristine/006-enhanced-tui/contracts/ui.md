---
feature: 006-enhanced-tui
kind: contract
created: 2026-07-07
---

# Contract — `src/cli/ui/` interfaces

Internal module contract (no public/network API). Types in `@../data-model.md`. Each entry names the
FR it serves and the test hook that proves it (Principle 5).

## capabilities.ts

```
detectCapabilities(env?, stdout?): Capabilities   // pure over injected env/stdout
```
- Serves FR-002/003/007/012. **Test:** inject non-TTY / `NO_COLOR` / narrow columns / non-UTF-8
  locale → assert each field flips as specified; invariants hold.

## theme.ts

```
symbols(caps): Symbols          // unicode set or ASCII fallback
paint(caps, style, s): string   // ANSI only when caps.color, else identity
```
- Serves FR-003/012. **Test:** `caps.color=false` ⇒ output has zero ANSI; `caps.unicode=false` ⇒
  ASCII glyphs.

## render.ts  (BaseCommand delegates here)

```
info(s): string
success(caps, s): string   // ✓/[ok] + style
warn(caps, s): string      // distinct treatment
error(caps, s, next?): string  // distinct from warn; optional next-step line
heading(caps, s): string
```
- Serves FR-001/008/009. `info` is a **plain passthrough** (guards `--json` byte-fidelity).
- **Test:** snapshot each kind under `color=true|false`; assert error≠warn styling; assert
  `info(json)` equals input exactly (SC-004).

## progress.ts

```
spinner(caps): { start(label), succeed(label), stop() }   // no-op frames when !isTTY
summarize(caps, result: WriteResult, opts:{dryRun}): string
```
- Serves FR-005/006. **Test:** `summarize` over a fixed `WriteResult` → expected counts; `dryRun`
  toggles "would" wording; non-TTY spinner emits no control codes.

## table.ts

```
renderTable(model: TableModel): string    // pure; fits model.width
progressCell(done, total): ProgressCell
```
- Serves FR-004/007. **Test:** at widths 120/80/40 assert no line exceeds width and columns drop by
  priority; a `ProgressCell` renders the right fill ratio; ASCII bar under `caps.unicode=false`.

## interactive/fullscreen.ts

```
runFullscreen(caps, { render:(state)=>string, reduce:(state,key)=>state, initial }): Promise<Result>
```
- Serves FR-013/014. Enters alt-screen + raw mode, restores on exit/`SIGINT`/`SIGTERM` via
  `finally`. If `!caps.isTTY`, callers must not invoke it (fall back to one-shot).
- **Test:** reducer tested purely (nav keys → state); host restore verified by asserting exit
  sequence emitted (`\x1b[?1049l`) and raw mode disabled.

## interactive/prompt.ts

```
multiSelect(caps, { message, options, preselected? }): Promise<string[]>
```
- Serves FR-015/016. **Precondition:** `caps.isTTY` — callers gate on it; when a required selection
  is missing and `!isTTY`, the command errors with guidance instead of calling this (never blocks).
- **Test:** simulated keypress stream (space/enter) → expected selection; non-TTY caller path
  asserts the guidance error, not a hang.

## Integration points (existing files to refactor)

- `base-command.ts`: `info/success/warn/error` delegate to `render.ts` (+ hold a `Capabilities`).
- `banner.ts`: drop local `useColor()`; use `theme.paint`.
- `dashboard.ts`: replace `formatTable` with `table.renderTable`; add progress cells; add
  `--interactive` → `runFullscreen` (US-6), TTY-gated.
- `init.ts` / `add.ts` / `sync.ts` / `upgrade.ts`: route `WriteResult` through `progress.summarize`;
  wrap long work in `spinner`; `init`/`add` call `multiSelect` when tool flags absent (US-7).

---
feature: 029-fleet-control-room
signed_off: true                  # set true by /amby.design after review; makes UI binding
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-11-18
---

# UI Design — Dashboard fleet control room

> **Signed off (T022), 2026-11-18.** Binding for plan/tasks/implement. The decisions are recorded under "Decisions" at the end.
> First-class artifact. Tokens live in `design-tokens.json` (same folder) and **extend 014's and 017's**
> (`specs/014-enhanced-dashboard/design-tokens.json`, `specs/017-live-dashboard/design-tokens.json`): every inherited token
> keeps its name and is cited as-is. Conventions: `@.amby/reference/design-conventions.md`. Terminal-medium rules from 006,
> 014 and 017 still hold: focus is the cursor plus the heavy frame; color is always paired with a glyph or text; every
> screen has a plain-text fallback.
>
> Starting point: the roadmap's Fleet-tab sketch. 029 ships a full-screen *view* (`l` from the overview); 032 re-hosts it as a
> tab, so the renderer stays a pure function of `FleetView` + selection + capabilities.

## Design inputs

- **Data (read-only, spec 025):** per lane — assistant, state (`working|waiting|blocked|paused|done`, plus `unreported`
  and `unknown` for missing or unreadable data), stalled flag and quiet minutes (025's `laneStatus`), directive action and
  derived status (`pending|pause requested|paused|obeyed|none`). Per run — status, phase, stage (`working|qa|architect`),
  round and limit, `needsDecision`, `gates[]`. **Stage, round and decision are run-level in 025's schema, so they appear once
  in the header, not per lane** (see Open questions).
- **Actions:** pause, continue (resume), stop — as directives through 025's `writeDirective`, per lane or whole run; approve a gate
  through 028's `approveGate` (never a directive).
- **Capability tiers (inherited):** wide ≥ `component.layout.wide-min`; narrow < `component.layout.min-columns`-adjacent breakpoint
  (60 columns for the Fleet view, FR-010); plain / `NO_COLOR` / non-TTY; icons nerd | unicode | ascii (`dashboard.icons`, `--icons`).

## US-1 — Every lane of the run, live

### Layout / wireframe

Wide, unicode icons (cursor on lane 2):

```
┏━ FLEET · 019-amby-run-prompt.1 · phase 2 · QA round 1/3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ● live ━━┓
┃   LANE       ASSISTANT    STATE        QUIET   DIRECTIVE                                         ┃
┃   lane-2-1   ✸ Claude     ▶ working    1m      —                                                ┃
┃ ▸ lane-2-2   ◎ Codex      ▶ working    21m     STALLED 21m · pause requested                     ┃
┃   lane-2-3   ✸ Claude     ◷ waiting    4m      —                                                ┃
┃   lane-2-4   ◇ OpenCode   ‖ paused     9m      paused                                            ┃
┃   lane-2-5   ✸ Claude     ✓ done       12m     —                                                ┃
┃   lane-2-6   ➤ Cursor CLI · unreported -       continue pending                                  ┃
┃   lane-2-7   ◉ Copilot    ? unknown    -       —                                                 ┃
┣━ GATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ phase-2 · after US-3, US-4 · awaiting approval                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ↑↓ lane · p pause · u continue · x stop · P/U/X whole run · a approve · esc back · ? help
```

Narrow (< 60 columns, compact: state word is never cut; assistant shrinks to its glyph):

```
┏━ FLEET · …1 · ph 2 · QA 1/3 ━━ ● ┓
┃▸ lane-2-2 ◎ ▶ working   21m STALLED
┃  lane-2-1 ✸ ▶ working    1m
┃  lane-2-3 ✸ ◷ waiting    4m
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Plain / ASCII / `NO_COLOR` (no box drawing, no glyph needed, the word carries the state):

```
FLEET 019-amby-run-prompt.1  phase 2  stage QA round 1/3  [live]
> lane-2-2  [CX] Codex     [>] working   21m  STALLED 21m, pause requested
  lane-2-1  [CC] Claude    [>] working    1m
  lane-2-3  [CC] Claude    [~] waiting    4m
GATES: phase-2 after US-3, US-4 -- awaiting approval
keys: up/down lane, p pause, u continue, x stop, a approve, esc back, ? help
```

No run (empty state, FR-013):

```
┏━ FLEET ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ No fleet run is active. Start one with `ambykit fleet start <feature>` or `ambykit run <feature>`. ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Component inventory

#### fleet-header
- **props:** run id, phase, stage, round, limit, needsDecision, live mode (017's `live-indicator`).
- **states:** default, needs-decision (`NEEDS A DECISION` in `fleet.needs-decision.fg`, always the words), more-runs (`+2 more runs`).
- **tokens:** `component.fleet-header.fg`, `component.live.*` (017), `semantic.color.accent`.
- **behavior:**
  - Given a run at stage `architect`, round 2 of limit 3, Then the header reads `architect round 2/3`.
  - Given `needsDecision`, Then `NEEDS A DECISION` is appended in the header (words, never color alone).
  - Given several unfinished runs, Then the newest shows and the header ends with `+N more runs`.

#### fleet-lane-row
- **props:** lane, assistant badge (017's `agent-badge`), state, quiet minutes, stalled, directive.
- **states:** default, selected (cursor `▸` + heavy frame, 014), stalled, unreported, unknown.
- **tokens:** `component.fleet-lane.state.<state>.{glyph,nerd,fg}`, `component.fleet-lane.stalled.*`, `component.fleet-lane.quiet-fg`.
- **behavior:**
  - Given two lanes of the same assistant, Then they are two rows with different lane names (FR-001).
  - Given an unreadable lane, Then its row says `unknown` and the others still show (FR-003).
  - Given a lane that never reported, Then it reads `unreported` with `-` for quiet time.
  - Given more lanes than rows, Then the list scrolls with the cursor and `↑ n more` / `↓ n more` rows (014's `elision`).

#### fleet-gates
- **props:** gates (id, after, state).
- **states:** none (section hidden), awaiting approval, approved (hidden once released).
- **tokens:** `component.fleet-gate.pending.fg`, `component.fleet-gate.glyph`.

### Content & accessibility

- Every state is a word first (`working`, `waiting`, `blocked`, `paused`, `done`, `unreported`, `unknown`); the glyph is decoration and
  the word is never truncated (FR-010).
- Quiet time is `<n>m`, or `-` when there is no report. Never negative (clock skew is clamped to now).
- Empty / error: no run → the empty state above; unreadable lane → `unknown` row; unreadable `run.json` → treated as no run.

## US-2 — Review-loop state

The header carries it: `working` · `QA round 1/3` · `architect round 2/3`. At the round limit with `needsDecision`:
`architect round 3/3 · NEEDS A DECISION`. Missing data reads as `working` (FR-004). Tokens: `semantic.color.accent` for the stage
word, `semantic.color.warn` for the needs-decision mark. No per-lane column: the stage is the run's, not a lane's.

## US-3 — Stalled lanes

A stalled lane keeps its state glyph and word and adds the text `STALLED <n>m` (n = quiet minutes, from 025's `laneStatus`) in
`component.fleet-lane.stalled.fg` with `semantic.weight.heading` (bold). The text is the signal; color and bold only reinforce it. It
clears on the next refresh after a report. Waiting, blocked, paused and done lanes never show it.

## US-4 — Pause, continue, stop

### Layout / wireframe

Directive status in the DIRECTIVE column: `—` (none), `continue pending`, `pause requested`, `paused`, `stop pending`, `obeyed`.
Pause requested stays until the lane's next report shows state `paused`.

Confirmation (stop, and any whole-run action; D8). Centered over the list, `y` confirms, anything else cancels and writes nothing:

```
┏━ STOP LANE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Stop lane-2-2 (◎ Codex)?                     ┃
┃ The worker finishes its current task first.  ┃
┃                          y confirm · n cancel ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Whole run: `STOP ALL LANES — 6 lanes of 019-amby-run-prompt.1`.

### Component inventory

#### fleet-confirm
- **props:** title, body, target (lane | run), action.
- **states:** open, closed.
- **tokens:** `component.fleet-confirm.border`, `component.fleet-confirm.title-fg`, 014's `panel` frame.
- **behavior:**
  - Given `x` on a lane, When `y`, Then a `stop` directive is written for that lane; any other key cancels and nothing is written (FR-008).
  - Given `P` (shift-p) on any lane, Then a confirm for the whole run opens; `y` writes one `pause` directive per lane.
  - Given `p` on a lane that is paused or already has a pause directive, Then nothing new is written and the row says so.
  - Given `u` after `p`, Then the `continue` replaces the pause (last write wins) and the row shows `continue pending`.

## US-5 — Gates

Awaiting gates are listed under GATES and mark their lanes `paused`. `a` approves the gate for the cursor lane's story checkpoint
(single gate: no prompt; several gates: the list takes a cursor, `a` approves the selected one) by calling 028's `approveGate`,
the same function as `ambykit run approve`. Declining (`esc`) writes nothing; the lane stays paused. Approval never writes a
`continue` directive.

## US-6 — Any terminal, any icon set

State glyphs per icon mode (a word always sits beside each): unicode `▶ ◷ ⊘ ‖ ✓ · ?`, ascii `[>] [~] [x] [|] [v] [.] [?]`,
nerd reuses the unicode glyph until Nerd Font code points are verified (see Open questions). `⏸` is avoided: some terminals draw it
two cells wide. `NO_COLOR` and non-TTY use the plain wireframe; resize re-flows between wide, narrow and plain.

## US-7 — Scripts keep working

No visual change. `--json --overview` gains an optional `fleet` object only when a run exists; bare `--json` and the one-shot text are
unchanged. See `contracts/dashboard-json-fleet.md` (T081).

## Help overlay additions (`?`)

| Key | Where | Action |
| --- | --- | --- |
| `l` | overview | open the Fleet view |
| `esc` | Fleet | back to the overview |
| `↑ ↓` | Fleet | select a lane |
| `p` / `P` | Fleet | pause the lane / the whole run |
| `u` / `U` | Fleet | continue the lane / the whole run |
| `x` / `X` | Fleet | stop the lane / the whole run (asks to confirm) |
| `a` | Fleet | approve the selected gate |

## Decisions

The five open questions of the draft were answered on 2026-11-18 (recorded by the coordinator on the person's behalf for 1–4):

1. **Continue key: `u` / `U`.** In the Fleet view continue is `u` (lane) and `U` (whole run). `c` stays "quality view" in the overview and is
   not used for continue anywhere, so no letter has two meanings. Bindings live in `FLEET_KEYS` (`src/cli/ui/interactive/fleet.ts`).
2. **Review state: header only.** Stage, round and limit appear once in the run header. There is no per-lane review column and no
   change to 025's or 019's `run.json` schema (the stage is run-level there).
3. **Whole-run actions always confirm.** Pause all (`P`), continue all (`U`) and stop all (`X`) each open a `y` / `n` confirmation,
   continue-all included.
4. **Several runs: newest plus a `+N more runs` line** is enough for 1.6; there is no run switcher until 032's tabs.
5. **Nerd Font glyphs: plan default kept.** The person was not asked. Nerd mode reuses the Unicode glyph until code points are verified
   against the glyph-names file; the candidates to verify later are Font Awesome `f04b` play, `f017` clock, `f05e` ban, `f04c` pause,
   `f00c` check, `f128` question.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [x] Reviewed and approved (2026-11-18, Gustavo Barrientos; decisions above).

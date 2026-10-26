---
feature: 017-live-dashboard
signed_off: true                  # set true by /amby.design after review; makes UI binding
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-10-26
---

# UI Design — Live dashboard — worktree-aware, realtime, agent presence, full TUI polish

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder). They **extend 014's tokens**
> (`specs/014-enhanced-dashboard/design-tokens.json`); every 014 token name stays valid and is cited
> as-is. Conventions: `@.amby/reference/design-conventions.md`. The terminal-medium rules from 006 and
> 014 still hold:
> - Focus is the cursor plus the heavy frame.
> - Color is always paired with a glyph or text.
> - Wireframes show Unicode; the ASCII fallbacks are each glyph token's `a` value.
> - Wireframe data is illustrative.

## Design inputs

| Question | Answer | Affects |
| --- | --- | --- |
| Where do worktree features show in one-shot output? | Same rows as any feature, with a checkout tag. The **Worktrees & agents** panel also appears in one-shot output, but only when at least one feature worktree exists. | US-1 |
| Process detection in one-shot output? | **No.** One-shot and `--json` read activity markers only, so they stay inside 014's 1-second budget (SC-003). Detection runs only in `--interactive`. | US-3 |
| Agent identity glyphs | A Unicode badge per agent by default; Nerd Font glyph when opted in (`--icons=nerd` or `AMBYKIT_ICONS=nerd`); text tag in ASCII. Each agent keeps the same color in every mode. | US-3 |
| Where is "live" shown? | In the header meta, right-aligned, in place of 014's `· interactive`. | US-2 |
| Agent detail placement | A one-line summary in the row or header, with full detail in the story detail and the feature view's CHECKOUT panel. | US-3, US-4 |

## US-1 — Worktree-aware progress

### Layout / wireframe

Rows in the 014 **FEATURE COMPLETION** chart get a checkout tag before the bar. Main-checkout rows
get none, so a project without worktrees renders byte-identical to 014 (FR-008).

```
FEATURE COMPLETION                                                       phase         clarif.
  014 enhanced-dashboard             ██████████████████████████████ 100%   done          ·
  015 parallel-lanes             ⎇   ███████▌░░░░░░░░░░░░░░░░░░░░░░  25%   implementing  ·
  016 agent-surface-expansion        ╌╌╌ not planned ╌╌╌╌╌╌╌╌╌╌╌╌╌╌        specified     2
  017 live-dashboard             ⎇●  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  12%   implementing  ·
                                 ^^ checkout tag: ⎇ = from its worktree, ● = dirty, ⊘ = merged/stale
```

The one-shot overview shows the **Worktrees & agents** panel (see US-3) between Attention/Up next and
Feature completion, but only when worktrees exist.

### Component inventory

#### CheckoutTag
- **props:** checkout: { kind: "main" | "worktree", branch?: string, dirty?: boolean, stale?: boolean }
- **states:** main (renders nothing, width 0), worktree, worktree-dirty, worktree-stale
- **tokens:** component.checkout-tag.glyph, component.checkout-tag.fg,
  component.checkout-tag.dirty.glyph, component.checkout-tag.dirty.fg,
  component.checkout-tag.stale.glyph, component.checkout-tag.stale.fg
- **behavior:**
  - Given a feature read from `.worktrees/<id>` (FR-002, FR-005), When its row renders, Then the
    tag shows the worktree glyph, followed by the dirty or stale glyph when that applies.
  - Given no feature comes from a worktree, When the chart renders, Then the tag column is not
    reserved at all (FR-008: output identical to 014).

#### CheckoutBadge (long form: feature view header, story detail, Worktrees & agents panel)
- **props:** same as CheckoutTag
- **states:** main, worktree, worktree-dirty, worktree-stale
- **tokens:** component.checkout-tag.*, semantic.color.muted
- **behavior:**
  - Given a worktree feature, When the long form renders, Then it reads `⎇ 017-live-dashboard`
    followed by `· dirty` and/or `· merged`; for main it reads `main`.

### Content & accessibility

- Copy: the words `dirty` and `merged` always appear in long forms. The short tag uses glyphs only
  because the long form and the help overlay both explain them.
- Errors: an unreadable worktree adds one 014 notice line:
  `⚠ skipped .worktrees/017-live-dashboard: <reason>` (`component.notice.*`) (FR-009).

## US-2 — Realtime interactive

### Layout / wireframe

Header meta (right-aligned on the 014 header line). It replaces `· interactive`:

```
◆ AmbyKit · dashboard                          ~/src/ambystech/oss/AmbyKit · v1.3.0 · ● live · 3s ago
◆ AmbyKit · dashboard                       ~/src/ambystech/oss/AmbyKit · v1.3.0 · ◌ polling · 3s ago
◆ AmbyKit · dashboard              ~/src/ambystech/oss/AmbyKit · v1.3.0 · ⚠ live paused — r to retry
```

- A refresh **repaints in place**, with no blank flash. The changed row's value is shown in
  `component.live.changed` for one heartbeat, then returns to normal.
- On resize, the next frame uses the new `layoutMode` (wide/narrow/plain) (FR-013).

### Component inventory

#### LiveIndicator
- **props:** mode: "watching" | "polling" | "paused", lastChange: Date, now: Date
- **states:** watching, polling (FR-015 fallback), paused (monitoring failed)
- **tokens:** component.live.watching.glyph, component.live.watching.fg,
  component.live.polling.glyph, component.live.polling.fg, component.live.paused.glyph,
  component.live.paused.fg, component.live.ago-fg
- **behavior:**
  - Given changes are being watched, When the header renders, Then it shows `● live · <ago>`
    (FR-014). `<ago>` is `now`, `Ns`, `Nm`, or `Nh`, and refreshes on the heartbeat.
  - Given change notification is unavailable, When the header renders, Then it shows `◌ polling`.
  - Given monitoring stopped with an error, When the header renders, Then it shows
    `⚠ live paused — r to retry`, and `r` restarts monitoring.
  - Given a future timestamp (clock skew), When `<ago>` is computed, Then it shows `now`.

#### ChangedHighlight
- **props:** keys: string[] (feature/story/task ids changed in the last refresh)
- **states:** default, changed (one heartbeat)
- **tokens:** component.live.changed
- **behavior:**
  - Given a refresh changed a feature's counts, When rows render, Then that row's percentage uses
    `component.live.changed` (bold accent) until the next heartbeat. This is a cue, not the only
    signal: the value itself changed.

### Content & accessibility

- No blinking or animation; one bold step only (WCAG 2.3).
- Cursor/selection rules (FR-012):
  - The cursor stays on the same **id**, not the same index.
  - If that id disappears, the cursor moves to the nearest row.
  - Filter text being typed is never lost.
  - An open help overlay stays open.

## US-3 — Agent presence

### Layout / wireframe

Overview, interactive, wide (the new panel sits in the focus cycle):

```
┏━ WORKTREES & AGENTS · 3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ▸ 017 live-dashboard     ⎇ 017-live-dashboard · dirty   ✸ Claude   implement T014   ● active 12s  ┃
┃   015 parallel-lanes     ⎇ 015-parallel-lanes           ◎ Codex    tasks            ○ idle 18m    ┃
┃   012 worktree-isolation ⎇ 012-worktree-isolation       —                           ⊘ merged      ┃
┃   ·   (unknown location) ~ ➤ Cursor CLI  running                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Feature completion gets an agent column before `phase`: a single badge glyph, or `·` when there is no
agent.

```
  017 live-dashboard             ⎇●  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  12%  ✸  implementing  ·
```

Agent badge in each mode (Claude shown):

| Mode | Render |
| --- | --- |
| Unicode (default) | `✸ Claude` in `component.agent.claude.fg` |
| Nerd Font opt-in | `<U+EC82> Claude` (falls back to the Unicode glyph for agents without a verified glyph) |
| ASCII / plain | `[CC] Claude` |
| Detected, not self-reported | prefixed `~`: `~ ✸ Claude` |
| Narrow (< `component.layout.wide-min`) | glyph only: `✸` |

### Component inventory

#### AgentBadge
- **props:** agent: string (emit-target id), source: "reported" | "detected", form: "full" | "glyph",
  icons: "unicode" | "nerd" | "ascii"
- **states:** known agent, unknown agent (generic badge, raw id as the name; FR-026), detected
- **tokens:** component.agent.<id>.glyph, component.agent.<id>.nerd, component.agent.<id>.tag,
  component.agent.<id>.fg, component.agent.<id>.name for every id in the agent table (claude,
  claude-vscode, codex, opencode, copilot, copilot-cli, cursor, cursor-cli, antigravity,
  antigravity-cli); component.agent.generic.*; component.agent.detected.prefix
- **behavior:**
  - Given a fresh marker `{agent: "codex"}`, When the badge renders, Then it shows `◎ Codex` in the
    Codex color (FR-025).
  - Given `icons: nerd` and an agent with a verified Nerd glyph, When the badge renders, Then the
    Nerd glyph replaces the Unicode one. Agents without one (Cursor, OpenCode, Antigravity) keep
    their Unicode glyph.
  - Given a detected agent with no marker (FR-022), When it renders, Then it gets the `~` prefix and
    the help overlay explains `~ = detected, not self-reported`.

#### PresenceLabel
- **props:** state: "active" | "idle" | "stale" | "none", since: Date
- **states:** active, idle, stale, none
- **tokens:** component.presence.active.glyph, component.presence.active.fg,
  component.presence.idle.glyph, component.presence.idle.fg, component.presence.stale.glyph,
  component.presence.stale.fg
- **behavior:**
  - Given activity under the active threshold (FR-021), When it renders, Then it shows
    `● active <ago>`; under the idle threshold, `○ idle <ago>`; otherwise `– stale <ago>`.
  - Given a merged worktree with no agent, When the row renders, Then it shows `⊘ merged` (from
    CheckoutTag) instead of a presence label.

#### WorktreesPanel
- **props:** rows: { feature, checkout, agent?, phase?, task?, presence }[],
  unlocated: { agent }[]
- **states:** default, focused, empty (no worktrees), elided (more rows than fit)
- **tokens:** component.panel.*, component.panel.focused.*, component.row.*, component.elision.*,
  component.hint-line.*
- **behavior:**
  - Given worktrees exist, When the overview renders, Then the panel lists one row per feature
    worktree, plus main-checkout features that have a fresh agent, ordered by presence (active,
    then idle, then stale) and then by feature number.
  - Given focus is on the panel, When ⏎ is pressed on a row, Then that feature's view opens (FR-029).
    The unknown-location rows are not openable, and the cursor skips them.
  - Given no feature worktrees and no agents, When the interactive overview renders, Then the panel
    shows its empty state: `No feature worktrees yet — run ambykit worktree NNN-slug to start one.`
    In one-shot output, the panel is omitted entirely.

### Content & accessibility

- Agent names come from the emit-target display names (Claude Code → `Claude`, GitHub Copilot CLI →
  `Copilot CLI`, …). The text name is always present except in narrow glyph form, where the help
  overlay provides a legend.
- Agent colors are identity, never status; status always comes from the presence glyph and word.

## US-4 — Polish every interactive screen

### Feature view (014 screen, extended)

```
◆ AmbyKit · dashboard › 017 live-dashboard                         ● live · 3s ago · implementing · 12%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ ARTIFACTS ─────────────────╮ ╭─ CHECKOUT & AGENT ──────────────╮ ╭─ STATUS ─────────────────────╮
│ ✓ spec.md      4 stories    │ │ ⎇ 017-live-dashboard · dirty    │ │ ✓ 0  ◐ 1  ○ 3  ✗ 0  – 0      │
│ ✓ ui.md        signed off   │ │ ✸ Claude  implement · T014      │ │ ███▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  │
│ ✓ plan.md                   │ │ ● active 12s                    │ ╰──────────────────────────────╯
│ ◐ tasks.md     5 / 41       │ │ also: ◎ Codex · tasks · stale 2h│
╰─────────────────────────────╯ ╰─────────────────────────────────╯
 OPEN CLARIFICATIONS · 0 — spec fully clarified.            <- collapses to one line when 0

STORIES
  ID    Title                              Progress           Status        Prio  Waiting on
▸ US-1  Worktree-aware progress            ████░░░░░░  40%   ◐ in-progress P1    —
  US-2  Realtime interactive dashboard     ░░░░░░░░░░   0%   ○ draft       P1    US-1
  ...

esc back  ↑↓ move  ⏎ story detail  ? help  q quit
```

- CHECKOUT & AGENT replaces the 014 clarifications panel's slot. Open clarifications move under the
  panels: a one-line summary when there are 0, the 014 panel at full width when there is 1 or more.

### Story detail (replaces the 006 `detailView`)

```
◆ AmbyKit · dashboard › 017 live-dashboard › US-1                          ● live · 3s ago · P1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Worktree-aware progress                                         ◐ in-progress · 4 / 10 · ████░░░░░░

╭─ TASKS · 4 of 10 done ──────────────────────────────────────────╮ ╭─ RELATIONS ─────────────────────╮
│ ✓ T001  Worktree list → checkout model                          │ │ depends-on  —                    │
│ ✓ T002  readProjectFeatures merge rules                         │ │ blocked-by  —                    │
│ ✓ T003  Ignore other features' copies                           │ │ blocks      US-2, US-3, US-4     │
│ ✓ T004  Worktree-only features                                  │ ╰──────────────────────────────────╯
│ ○ T005  Dirty / merged state                                    │ ╭─ CHECKOUT & AGENT ───────────────╮
│ ○ T006  Burndown from worktree branch                           │ │ ⎇ 017-live-dashboard · dirty     │
│ ⋮  4 more                                                        │ │ ✸ Claude  implement · T005       │
╰─────────────────────────────────────────────────────────────────╯ │ ● active 12s                     │
                                                                    ╰──────────────────────────────────╯
esc back  ↑↓ scroll tasks  ? help  q quit
```

- Narrow: RELATIONS and CHECKOUT & AGENT stack under TASKS. Plain: section headings with no frames.
- Task ticks update live (US-2). A task that was just checked uses `component.live.changed` for one heartbeat.

### Help overlay (`?`, any screen)

```
                 ╭─ KEYS · overview ───────────────────────────────╮
                 │ tab / ⇧tab   next / previous panel              │
                 │ ↑ ↓          move                               │
                 │ ⏎            open                               │
                 │ f            filter by feature                  │
                 │ s            cycle status filter                │
                 │ r            retry live updates (when paused)   │
                 │ q            quit                               │
                 │                                                 │
                 │ ⎇ worktree  ● dirty  ⊘ merged  ~ detected agent │
                 │ ✸ Claude ◎ Codex ◇ OpenCode ➤ Cursor ◉ Copilot  │
                 ╰─ any key to close ──────────────────────────────╯
```

- The overlay is centered over the dimmed current frame (`component.overlay.backdrop`) and uses the
  focused frame. It lists only the current screen's keys, plus the glyph legend.

### Filter entry (014 `f`, restyled)

```
 filter  ( 017_                                   )   ⏎ apply  esc cancel
```

- Shown in the key-hint row, so the screen doesn't shift. The input uses `component.input.*`, and
  the caret is the `▏` glyph. A refresh arriving mid-typing never clears the buffer.

### Empty and error states

| Condition | Render |
| --- | --- |
| No features | Header, then a centered `component.empty-state` block: `No feature specs yet.` / `Run /amby.specify to create one.` |
| Filter matches nothing | Panels show `Nothing matches filter "<f>" — esc to clear.` |
| No worktrees (interactive) | WorktreesPanel empty state (US-3). |
| Parse issues | 014 notice lines. If there are more than 3, show `⚠ 5 files skipped — ? for details`, with the list in the help overlay. |
| Monitoring paused | LiveIndicator `paused` state. |
| Terminal < `component.layout.min-columns` | 014 plain layout, still live. |

### Component inventory

#### StoryDetail
- **props:** story: StoryProgress, tasks: TaskLine[], relations: {dependsOn, blockedBy, blocks},
  checkout, agent?
- **states:** default, empty (`No tasks tagged [US-n] yet.`), scrolled (elided top/bottom)
- **tokens:** component.header.*, component.panel.*, component.artifact-item.*,
  component.completion-bar.*, component.elision.*, component.key-hints.*, component.live.changed
- **behavior:**
  - Given ⏎ on a story (FR-028), When the detail opens, Then it shows TASKS, RELATIONS and
    CHECKOUT & AGENT in panels, with a one-line story summary under the header.
  - Given more tasks than fit, When ↑↓ is pressed, Then the task list scrolls with elision markers.

#### HelpOverlay
- **props:** screen: "overview" | "feature" | "story", keys: {key, label}[]
- **states:** open, closed
- **tokens:** component.overlay.backdrop, component.panel.focused.*, component.key-hints.*
- **behavior:**
  - Given any screen, When `?` is pressed (FR-030), Then the overlay opens. Any key closes it, and
    that key is not passed through to the screen.

#### FilterInput
- **props:** value: string, active: boolean
- **states:** inactive (hidden), active, empty
- **tokens:** component.input.label-fg, component.input.fg, component.input.caret,
  component.input.frame-fg, component.key-hints.*
- **behavior:**
  - Given `f` is pressed, When typing, Then the hint row becomes the input. ⏎ applies the filter and
    esc cancels and restores the previous filter.

#### EmptyState
- **props:** title: string, hint: string
- **states:** default
- **tokens:** component.empty-state.title-fg, component.empty-state.hint-fg, component.hint-line.command-fg
- **behavior:**
  - Given an empty condition from the table above (FR-031), When the screen renders, Then the
    block shows a title and a next-step hint that includes the command.

### Content & accessibility

- Every screen has the key-hint footer, and `? help` is always in it.
- Contrast: new color tokens meet AA on dark and light terminals (see `$contrast` in tokens).
  Agent identity colors are text colors and meet 4.5:1.
- Plain/NO_COLOR/ASCII (FR-033): agents become `[CC] Claude`, checkout tags become `wt` / `wt*` /
  `wt-merged`, live becomes `live 3s ago`, and the overlay uses ASCII frames.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [x] Reviewed and approved (US-1 to US-4) — Gustavo Barrientos, 2026-10-26.

---
feature: 017-live-dashboard
title: Live dashboard — worktree-aware, realtime, agent presence, full TUI polish
branch: 017-live-dashboard
status: draft
created: 2026-10-26
---

# Spec — Live dashboard — worktree-aware, realtime, agent presence, full TUI polish

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).

Feature 014 made the dashboard's front page readable. Three gaps remain. Progress made inside
`.worktrees/<feature>` is not visible from the main checkout. Interactive mode is a frozen snapshot.
The screens behind the front page still look like the 006 screens. Teams that run several assistants
in parallel worktrees cannot see, from one place, what is moving and who is moving it.

## User scenarios & testing

### US-1 — Worktree-aware progress  (priority: P1)

As a developer orchestrating features in worktrees, I want the dashboard to show progress made in every
feature worktree while I sit on the main checkout, so that I don't have to `cd` into each worktree to
know where things stand.

- **Why this priority:** worktree isolation (012) is the recommended way to work in parallel, and the
  dashboard is blind to it today. Every other story builds on this view.
- **Independent test:** with one feature worktree that has more checked tasks than main's copy, run
  the dashboard from main and see the worktree's counts, marked as coming from that worktree.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature worktree `.worktrees/NNN-slug` whose `tasks.md` has 5/10 tasks checked while main's
  copy has 0/10, When I run the dashboard from main, Then that feature shows 5/10 and a worktree
  indicator naming its branch.
- Given a feature spec that exists only inside its worktree, When I run the dashboard from main, Then
  the feature appears in the overview, ordered by number like any other feature.
- Given I run the dashboard from inside a feature worktree, When it renders, Then I see the same set of
  features and counts as from main.
- Given a worktree also contains stale copies of *other* features' specs, When the dashboard merges
  checkouts, Then those copies are ignored and only the worktree's own feature overrides main.
- Given a worktree has uncommitted changes, or its branch is already merged, When it renders, Then the
  indicator shows dirty or stale state.
- Given a project with no worktrees, or not a git repository, When the dashboard runs, Then output is
  identical to today's (no worktree indicators, no errors).
- Given a worktree directory that is missing or unreadable, When the dashboard runs, Then the rest still
  renders and the problem is reported as a parse issue.

### US-2 — Realtime interactive dashboard  (priority: P1)

As a developer watching one or more assistants work, I want `dashboard --interactive` to update by itself
as artifacts change in any checkout, so that I can leave it open as a live monitor.

- **Why this priority:** the user explicitly asked for real-time progress; a snapshot TUI forces
  quit-and-relaunch to see anything move.
- **Independent test:** open the interactive dashboard, tick a task in a worktree's `tasks.md` from
  another terminal, and see the count change without pressing a key.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the interactive dashboard is open, When a `tasks.md`, `spec.md`, `ui.md` or `plan.md` changes in
  main or any feature worktree, Then the affected views re-render with the new data without user input.
- Given a feature worktree is created or removed while the dashboard is open, When that happens, Then the
  feature list and worktree indicators update.
- Given my cursor is on a row that disappears after a refresh, When the refresh applies, Then the cursor
  moves to the nearest valid row and the dashboard does not crash.
- Given I am typing a filter, When a refresh arrives, Then my input is kept and the refresh applies under
  the current filter.
- Given the terminal is resized, When the resize happens, Then the layout re-flows to the new width
  (wide / narrow / plain).
- Given the interactive dashboard is open, When I look at the header, Then I see that it is live and how
  long ago the data last changed.
- Given the dashboard is not interactive (one-shot, `--json`, non-TTY), When it runs, Then it reads once
  and exits as today.

### US-3 — Agent presence  (priority: P2)

As a developer running several assistants at once, I want each feature to show which assistant is
working on it, in which phase, and how recently, with a recognisable icon, so that I can tell at a
glance which lanes are active, idle or abandoned.

- **Why this priority:** high value for multi-agent work, but the dashboard is useful without it.
- **Independent test:** run the self-report step for a feature as Codex in phase `implement`, and see a
  Codex icon, the phase and "active" on that feature; wait past the threshold and see it turn idle.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an assistant runs a generated `/amby.*` phase command for a feature, When the phase starts, Then
  the assistant records an activity marker naming its own tool, the phase, and the time, inside that
  feature's checkout.
- Given a fresh activity marker, When the dashboard renders, Then the feature shows the agent's icon and
  name, the phase, and "active".
- Given a marker that is older than the active threshold but the feature's tasks changed recently, When
  the dashboard renders, Then it still shows "active".
- Given a marker older than the idle threshold, When the dashboard renders, Then it shows "stale" with
  how long ago.
- Given no marker but a known assistant process is detected working in that feature's checkout, When the
  dashboard renders, Then the agent is shown as *detected* (visually distinct from self-reported).
- Given an assistant process is detected but its working directory cannot be determined, When the
  dashboard renders, Then it is listed as running with an unknown location, not attributed to a feature.
- Given the terminal supports Nerd Fonts and I opted in, When agents render, Then brand glyphs are used;
  otherwise a colored Unicode badge is used, and in ASCII/plain mode a short text tag.
- Given an unknown agent id in a marker, When it renders, Then a generic badge with the raw id is shown.

### US-4 — Polish every interactive screen  (priority: P2)

As a dashboard user, I want every interactive screen, not only the front page, to share the 014 design
language, so that the app feels like one product and the new live data has a home.

- **Why this priority:** consistency and discoverability; it does not unblock anything else.
- **Independent test:** open each screen (overview, feature, story detail, filter entry, help, worktrees
  & agents, empty/error states) in wide, narrow and plain modes; each uses framed panels, tokens and a
  key-hint footer.
- **depends-on:** [US-1, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given I press ⏎ on a story in the feature view, When the story detail opens, Then it shows the story's
  tasks (with live check state), dependencies, blockers, checkout and agent in framed panels with a
  key-hint footer.
- Given the overview, When I tab through panels, Then a **Worktrees & agents** panel is in the focus
  cycle and ⏎ on a row opens that feature.
- Given any screen, When I press `?`, Then a help overlay lists the keys for that screen; any key closes it.
- Given filter entry is active, When I type, Then the input line is styled consistently and shows how to
  confirm or cancel.
- Given no features, no worktrees, or parse issues, When the relevant screen renders, Then a designed
  empty or error state explains what to do next.
- Given NO_COLOR or ASCII-only terminals, When any screen renders, Then it stays legible (014 rules).

## Requirements (EARS)

**Worktree-aware reading (US-1)**
- FR-001  THE SYSTEM SHALL build the feature list from the primary checkout plus every feature worktree
  under `.worktrees/`, whichever checkout the command runs from.
- FR-002  WHEN a feature worktree contains its own feature directory, THE SYSTEM SHALL use that copy in
  place of the primary checkout's copy.
- FR-003  THE SYSTEM SHALL ignore copies of other features found inside a feature worktree.
- FR-004  WHEN a feature exists only inside its worktree, THE SYSTEM SHALL include it in all views.
- FR-005  THE SYSTEM SHALL mark each feature read from a worktree with its branch and with dirty and
  merged state.
- FR-006  WHEN showing story tasks or burndown for a worktree feature, THE SYSTEM SHALL read them from that
  worktree's checkout and branch history.
- FR-007  WHERE JSON output is requested, THE SYSTEM SHALL include each feature's source checkout.
- FR-008  IF the project is not a git repository or has no feature worktrees, THEN THE SYSTEM SHALL produce
  output identical to the pre-017 behavior.
- FR-009  IF a worktree cannot be read, THEN THE SYSTEM SHALL report it as a parse issue and render the
  rest.

**Realtime (US-2)**
- FR-010  WHILE the interactive dashboard is open, WHEN a feature artifact changes in any checkout, THE
  SYSTEM SHALL re-render affected views within 1 second without user input.
- FR-011  WHILE the interactive dashboard is open, WHEN a feature worktree is added or removed, THE SYSTEM
  SHALL update the feature list.
- FR-012  WHEN a refresh applies, THE SYSTEM SHALL keep the current view, filter, and in-progress input,
  and clamp cursors to valid rows.
- FR-013  WHEN the terminal is resized, THE SYSTEM SHALL re-lay out the current screen.
- FR-014  WHILE the interactive dashboard is open, THE SYSTEM SHALL show a live indicator and the time
  since data last changed.
- FR-015  IF change notification is unavailable on the platform, THEN THE SYSTEM SHALL fall back to
  periodic checking at no more than a 2-second interval.
- FR-016  WHEN the interactive dashboard exits, THE SYSTEM SHALL stop all monitoring and restore the
  terminal (014 FR-013 still holds).
- FR-017  THE SYSTEM SHALL NOT monitor anything in non-interactive modes.

**Agent presence (US-3)**
- FR-018  THE SYSTEM SHALL provide a command that records an activity marker for a feature: agent id,
  phase, optional task id, and timestamp, stored in that feature's checkout.
- FR-019  THE SYSTEM SHALL keep activity markers out of version control.
- FR-020  WHEN generating phase commands for a tool, THE SYSTEM SHALL include a single step that records
  activity with that tool's own id (per Principle 1; per Principle 3 the step is one line).
- FR-021  THE SYSTEM SHALL classify agent activity as active (under 2 minutes), idle (under 30 minutes) or
  stale, using the newer of the marker time and the feature's last task change. The thresholds
  SHALL be overridable in project config. (Clarified: defaults 2 min / 30 min, configurable.)
- FR-022  IF no fresh marker exists for a feature, THEN THE SYSTEM SHALL try to detect a known assistant
  process working in that feature's checkout and show it as *detected*.
- FR-023  IF a detected assistant's working location cannot be determined, THEN THE SYSTEM SHALL list it
  as running with an unknown location and SHALL NOT attribute it to a feature.
- FR-024  THE SYSTEM SHALL recognise at least Claude Code, Codex, OpenCode, Cursor and GitHub Copilot, plus
  every other supported emitter target, by the same id used for emit targets. Process detection
  covers the CLI agents whose executable names are documented (see Clarifications C-2); IDE-hosted
  agents are identified by self-report only.
- FR-025  WHERE the user opts into Nerd Font icons, THE SYSTEM SHALL render each agent with a brand glyph;
  otherwise a colored Unicode badge; and in ASCII/plain mode a short text tag. Agents without a
  verified glyph (Clarifications C-3) use the badge even in Nerd Font mode.
- FR-026  IF a marker names an unknown agent, THEN THE SYSTEM SHALL render a generic badge with the raw id.
- FR-027  Process detection SHALL be read-only and SHALL run no more often than every 5 seconds.

**Polish (US-4)**
- FR-028  THE SYSTEM SHALL render the story detail screen with the 014 panels, tokens and key-hint footer,
  including live task check state, dependencies, blockers, checkout and agent.
- FR-029  THE SYSTEM SHALL add a Worktrees & agents panel to the overview focus cycle; ⏎ opens the feature.
- FR-030  WHEN the user presses `?`, THE SYSTEM SHALL show a help overlay of the current screen's keys.
- FR-031  THE SYSTEM SHALL render designed empty and error states for no features, no worktrees and parse
  issues.
- FR-032  THE SYSTEM SHALL show agent and checkout indicators in the feature view header and the feature
  completion chart.
- FR-033  Every interactive screen SHALL support wide, narrow and plain layouts and NO_COLOR/ASCII.

## Clarifications

- **C-1 (FR-021)** Activity thresholds default to 2 min (active) / 30 min (idle) and are configurable.
- **C-2 (FR-024)** Documented CLI executables, checked 2026-10-26:
  `claude` (Claude Code, native and npm installs; code.claude.com/docs/en/setup) · `codex`
  (learn.chatgpt.com/docs/codex/cli) · `opencode` (opencode.ai/docs) · `copilot` (GitHub Copilot CLI;
  docs.github.com CLI command reference) · `agent`, formerly `cursor-agent` (Cursor CLI;
  cursor.com/docs/cli/installation). `agent` is a generic name, so it counts only when its path
  identifies Cursor. IDE-hosted agents (Cursor, Copilot in VS Code, Claude in VS Code, Antigravity) run
  inside the editor process and cannot be told apart; self-report only.
- **C-3 (FR-025)** Nerd Fonts v3.5.1 (glyphnames.json, 2026-08-21) has Codicons `cod-claude` U+EC82,
  `cod-openai` U+EC81 (Codex) and `cod-copilot` U+EC1E (Copilot, Copilot CLI). There is no brand glyph
  for Cursor, OpenCode or Antigravity; those keep the badge. `cod-robot` U+EC20 is the generic glyph. The worktree tag uses `oct-git_branch` U+F418 in Nerd mode. Revised 2026-10-26 after the Windows
  hallway test: agent icons stay Unicode in Nerd mode, since older Nerd Fonts lack the brand glyphs.

## Success criteria

- SC-001  From the main checkout, 100% of feature worktrees' task progress matches what the dashboard shows
  when run inside each worktree.
- SC-002  A task checked in any checkout appears in an open interactive dashboard within 1 second in ≥ 95%
  of trials on Windows, macOS and Linux.
- SC-003  With 10 worktrees and 50 features, the one-shot dashboard still renders in under 1 second
  (014 performance budget).
- SC-004  An assistant that runs a generated phase command is shown with the correct agent identity in
  100% of trials across the supported tools.
- SC-005  Every interactive screen passes the wide/narrow/plain and NO_COLOR/ASCII render tests; no
  screen still uses the 006 styling.
- SC-006  Leaving the interactive dashboard open for 30 minutes leaves no orphaned watchers or processes,
  and idle CPU stays negligible.

## Edge cases

- Feature dir renamed inside a worktree (slug change): treat the worktree copy as the feature's source.
- Two worktrees for the same feature number (number collision): both shown, disambiguated as in 014.
- Worktree path outside `.worktrees/` (made manually with `git worktree add`): ignored, as in 012.
- Several agents report on the same feature: show the most recent; list the others in story detail.
- Activity marker is corrupt or partial: ignore it and fall back to detection.
- Burst of file changes (an agent rewriting `tasks.md` repeatedly): coalesced into one refresh.
- Clock skew or a future timestamp in a marker: treated as "now" and not shown as negative time.
- Very narrow terminals: the agent icon degrades to a single-character tag.

## Assumptions

- AmbyKit still does not launch or supervise assistants (consistent with 015); presence is observed only.
- Only worktrees created under `.worktrees/` by `ambykit worktree` are in scope.
- The self-report step relies on the assistant running a shell command; where a tool cannot, detection
  is the only signal.
- Process detection uses only information available to the current user without elevated privileges.
- Out of scope: editing from the dashboard, multi-repo aggregation, remote/cloud agents, and notifications.
- Relationship to 015 (parallel lanes): 015 US-4 lane progress should reuse the worktree-aware reading
  defined here.

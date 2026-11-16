---
feature: 023-dependency-graph          # NNN-slug
title: Shared dependency graph
branch: 023-dependency-graph
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Shared dependency graph

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Stories already link through `depends-on` and `blocked-by`, and `ambykit analyze` checks them. But every
consumer (analyze, the dashboard, and soon the run scheduler and the MCP server) re-reads the markdown
and builds its own map, and there are no feature-level edges. This feature adds **one shared graph**,
built from the spec files on demand, that every consumer reads, plus a local `ambykit graph` command and
a dashboard graph view. Everything runs at zero model tokens (Principle 3).

**Out of scope:** task-to-task edges (task order, `[P]` markers and file ownership already cover them),
a new dependency syntax, a stored or cached graph file, and any web view. Spec format v2 (later) only
changes where edges are read from.

## User scenarios & testing

### US-1 — One graph of stories and features  (priority: P1)

As a maintainer of AmbyKit tooling, I want one function that turns the spec files into a graph of
stories and features, so that every consumer sees the same dependencies instead of re-parsing markdown.

- **Why this priority:** every other story and every downstream consumer needs this graph.
- **Independent test:** build the graph from two sample features and confirm story nodes, story edges
  and the derived feature edge are all present and correct.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given features with stories, When the graph is built, Then each story is a node identified by
  feature and story ID, with its status.
- Given a story with `depends-on` or `blocked-by`, When the graph is built, Then an edge of the matching
  kind exists from that story to the one it names.
- Given a story in feature A that depends on a story in feature B, When the graph is built, Then a
  feature edge from A to B is derived and lists the story edges that cause it.
- Given the same files, When the graph is built twice, Then the result is identical, and building it
  changes no file.
- Given a dependency that names a story or feature that does not exist, When the graph is built, Then
  it is reported as a broken edge, not dropped silently.
- Given a dependency cycle, When the graph is built, Then the cycle is reported with the IDs involved.

### US-2 — Read today's syntax unchanged  (priority: P1)

As a maintainer of an existing AmbyKit project, I want the graph to read my current specs as they are,
so that I get it in 1.5 without editing anything.

- **Why this priority:** 1.x must stay additive; breaking changes belong to 2.0.
- **Independent test:** build the graph from every existing `specs/*/spec.md` in this repo and confirm
  the story edges match what `analyze` reports today.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given `depends-on: [US-1]` in a spec, When read, Then it is a same-feature edge.
- Given `depends-on: [015:US-2]` in a spec, When read, Then it is a cross-feature edge to that story.
- Given `blocked-by` in a spec, When read, Then it is read as a blocking edge distinct from `depends-on`.
- Given the existing specs in this repo, When the graph is built, Then its edges match today's
  `analyze` results with no new errors.
- Given a spec with no dependencies, When the graph is built, Then it appears as a node with no edges.

### US-3 — Print the graph from the command line  (priority: P1)

As a developer, I want a local command that prints the graph, so that I can see what blocks what
without opening files or spending tokens.

- **Why this priority:** it is the direct, scriptable face of the graph and the way to verify it.
- **Independent test:** run `ambykit graph` on this repo and confirm text output; run with `--json` and
  `--mermaid` and confirm each is well-formed.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** in-progress

**Acceptance criteria**
- Given a project, When `ambykit graph` runs, Then it prints the graph as readable text with no model
  call.
- Given `--json`, When it runs, Then the output is a stable, documented shape with nodes, story edges
  and feature edges.
- Given `--mermaid`, When it runs, Then the output is valid diagram text that renders the same edges.
- Given a feature number argument, When it runs, Then only that feature and its neighbors are shown.
- Given broken edges or cycles, When it runs, Then they are listed and the exit status says so.
- Given a project with no specs, When it runs, Then it says so and exits cleanly.

### US-4 — Consumers use the shared graph  (priority: P1)

As a maintainer, I want `analyze`, the dashboard, the run scheduler and the MCP server to call the one
graph instead of parsing dependencies themselves, so that they cannot disagree.

- **Why this priority:** it removes the duplicated parsing that this feature exists to end.
- **Independent test:** change a dependency in one spec and confirm `analyze` and the dashboard both
  reflect it with no other change.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given `analyze` runs, When it checks dependencies, Then it uses the shared graph and its findings are
  unchanged for the existing specs.
- Given the dashboard shows blocked or buildable stories, When it computes them, Then it uses the shared
  graph.
- Given the run scheduler (spec 028) or MCP server (spec 025) need dependencies, When they run, Then
  they call the same graph and do not re-parse specs.
- Given a story is blocked, When any consumer reports it, Then all consumers name the same blocker.

### US-5 — See what is buildable now and the critical path  (priority: P2)

As a team lead, I want to know which stories can start now and which chain of stories limits delivery,
so that I can order work and spot the bottleneck.

- **Why this priority:** it turns the graph into a planning aid, but depends on the graph existing.
- **Independent test:** on a sample graph, confirm the buildable set and the critical path match a
  hand-computed answer.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the graph, When buildable stories are requested, Then they are the not-done stories whose
  dependencies are all done and whose blockers are cleared.
- Given the graph, When the critical path is requested, Then it is the longest chain of not-done
  stories by dependency, listed in order.
- Given a story is done, When the graph is rebuilt, Then it no longer blocks the stories that depended
  on it.
- Given two chains of equal length, When the critical path is reported, Then the choice is stable
  between runs.

### US-6 — Explore the graph in the interactive dashboard  (priority: P2)

As a team lead, I want a graph view in the interactive dashboard, so that I can see what blocks what
and jump from a story to its feature.

- **Why this priority:** it is the visual payoff, but the command already covers the data.
- **Independent test:** open the interactive dashboard, switch to the graph view, select a story and
  jump to its feature.
- **depends-on:** [US-3, US-5]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given `--interactive`, When the graph view is opened, Then it shows blockers, buildable stories and
  the critical path.
- Given a selected story, When the person jumps, Then the dashboard shows its feature.
- Given one-shot or `--json` dashboard output, When it runs, Then the graph is not loaded and the
  1-second budget holds.
- Given a narrow or plain-text terminal, When the graph view is opened, Then it falls back to a text
  list with the same information.
- Given this feature ships, When the dashboard is run with `--interactive`, Then a basic graph view is
  available on its own, not only the data; spec 032 later restyles it inside the tabbed layout.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL provide one function that builds, from the spec files, a graph of story
  nodes, story edges, and feature edges derived from them, with no side effects.
- FR-002  WHEN a story in feature A depends on a story in feature B, THE SYSTEM SHALL derive a feature
  edge from A to B recording the story edges that cause it.
- FR-003  THE SYSTEM SHALL read `depends-on`, `blocked-by` and `NNN:US-#` cross-feature references
  exactly as written in existing specs, distinguishing dependency edges from blocking edges.
- FR-004  IF a dependency names a story or feature that does not exist, THEN THE SYSTEM SHALL report a
  broken edge naming both ends.
- FR-005  IF the graph contains a cycle, THEN THE SYSTEM SHALL report the IDs in the cycle.
- FR-006  THE SYSTEM SHALL produce an identical graph from identical files, regardless of file or
  directory order.
- FR-007  WHEN `ambykit graph` runs, THE SYSTEM SHALL print the graph at zero model tokens as text, and
  as `--json` or `--mermaid` on request.
- FR-008  THE `--json` output SHALL have a stable, documented shape that adds fields without removing
  or renaming existing ones.
- FR-009  WHEN a feature argument is given, THE SYSTEM SHALL show only that feature and its direct
  neighbors.
- FR-010  IF the graph has broken edges or cycles, THEN `ambykit graph` SHALL list them and exit with a
  non-zero status.
- FR-011  THE SYSTEM SHALL make `analyze`, the dashboard, the run scheduler and the MCP server obtain
  dependencies from this graph and not by parsing specs themselves.
- FR-012  WHEN buildable stories are requested, THE SYSTEM SHALL return the not-done stories whose
  dependencies are done and blockers cleared.
- FR-013  WHEN the critical path is requested, THE SYSTEM SHALL return the longest chain of not-done
  stories in dependency order, stable across runs.
- FR-014  WHERE the dashboard runs with `--interactive`, THE SYSTEM SHALL offer a graph view showing
  blockers, buildable stories, the critical path, and a jump from a story to its feature.
- FR-015  WHILE the dashboard runs one-shot or with `--json`, THE SYSTEM SHALL NOT load the graph view
  and SHALL keep the 1-second budget.
- FR-016  WHILE the terminal is narrow or lacks color and glyph support, THE SYSTEM SHALL show the graph
  view as a plain text list.
- FR-017  THE SYSTEM SHALL leave `analyze` findings on existing specs unchanged by this feature.
- FR-018  THE graph prompt text, if any, SHALL be authored once in the neutral source and emitted per
  tool (Principle 1), and SHALL NOT restate the graph where an ID suffices (Principle 3).

## Success criteria

- SC-001  Building the graph for all specs in this repo completes within the dashboard's 1-second
  one-shot budget and uses zero model tokens.
- SC-002  The graph's story edges for the existing specs equal what `analyze` reports before this
  change, with no new errors.
- SC-003  `analyze`, the dashboard, and `ambykit graph` always agree on the blockers of any story,
  verified by a test that compares them.
- SC-004  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test`
  pass.
- SC-005  Feature 023 is itself built using its own graph to order its stories, and its stories'
  dependencies resolve with no broken edges (the 1.5 gate, Principle 6).

## Edge cases

- A story that depends on itself.
- A cross-feature reference to a feature that exists but has no stories yet.
- A feature directory with a malformed or missing spec.
- A story marked done that still has an open blocker.
- Two features that each depend on a story in the other, but with no story cycle.
- A very large number of features: output stays readable, and the one-shot budget holds.
- The same dependency written twice, or in both `depends-on` and `blocked-by`.
- Features in worktrees: the graph reflects the specs visible from where it runs.

## Assumptions

- Stories carry stable `US-#` IDs, and cross-feature references use the `NNN:US-#` form already used in
  specs.
- Story status values are those in the current spec template (draft, ready, in-progress, blocked, done).
- Spec format v2 will only change where edges are read from and may add an optional feature-level
  `depends-on`; the graph's shape does not change.
- The run scheduler (spec 028) and the MCP server (spec 025) arrive after this feature and consume it.
- The dashboard's tabbed redesign (spec 032) will host the graph view; this feature must not depend on it.

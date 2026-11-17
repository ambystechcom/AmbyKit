---
feature: 025-mcp-server
status: draft
created: 2026-11-16
---

# Implementation Plan — AmbyKit as an MCP server

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.
> No UI in this feature, so there is no `ui.md`. Supporting files: `data-model.md` (files and
> invariants), `contracts/tools.md` (tool inputs and outputs).

## Technical context

- **Stack:** Node ≥ 20, TypeScript ESM (NodeNext, `.js` import extensions), Vitest. New code in
  `src/core/` (pure + thin fs edges, Principle 2 of AGENTS.md), `src/mcp/` (protocol and tools) and
  `src/cli/` (two `BaseCommand` subclasses).
- **Key libraries:** none new. `zod` (already a dependency) validates tool inputs and, through
  `z.toJSONSchema`, publishes each tool's input schema. The MCP stdio transport is hand-rolled
  (newline-delimited JSON-RPC 2.0: `initialize`, `ping`, `tools/list`, `tools/call`); see Open decisions.
- **Constraints driving choices:**
  - Principle 3: every read tool returns a slice (SC-001), never a whole file; the server itself uses zero
    model tokens.
  - Principle 4: the MCP protocol revision and each target's MCP entry shape are verified in Phase 0 and
    recorded in `docs/tool-compatibility.md` before any emitter writes them. Nothing is guessed.
  - Principle 7: opt-in via `.amby/config.json`; project-level files only; user-level files only through
    the existing `sync --include-user` consent and never in the in-sync check.
  - Principles 1 and 6: the config is emitted from the neutral source by emitters; the repo enables the
    server on itself and `ambykit sync` stays diff-free.
  - Parallel lanes (015) put each lane in its own worktree, so shared fleet state lives in the primary
    checkout (`primaryRoot` in `src/core/checkouts.ts`), as spec FR-010 requires.

## Architecture

```
assistant ──stdio JSON-RPC──▶ ambykit mcp (src/cli/mcp.ts → src/mcp/server.ts)
                                  │ registry: zod-validated tools (src/mcp/registry.ts)
        ┌─────────────────────────┼───────────────────────────┐
   read tools                 write tools                  fleet tools
   src/mcp/tools/read.ts      src/mcp/tools/write.ts       src/mcp/tools/fleet.ts
        │                          │                            │
   src/core/query.ts          src/core/tasks-edit.ts       src/core/report.ts   (shared with CLI)
   src/core/fleet/lane-status.ts  src/core/fleet/lock.ts   src/core/fleet/{runs,directives,claims,notes,types}.ts
        └────────── existing: dashboard.ts (parseTasks/Stories), analyze.ts, lanes.ts, activity.ts ─┘

ambykit activity  (--lane --state --run) ─┐
ambykit directive <feature> <lane> pause|resume|stop ─┴─▶ the same core functions
```

- **One writer per concern.** `report_activity` and `ambykit activity` both call `reportActivity`
  (`src/core/report.ts`), which calls `writeMarker` in `src/core/activity.ts` (FR-007). `ambykit directive`
  and the dashboard call `writeDirective` (FR-023). The server adds no logic of its own.
- **025 owns fleet state (contract C1).** All fleet state code lives in the directory `src/core/fleet/*`
  (never a single `fleet.ts`) and everything under `.amby/fleet/<run>/`. Specs 019 (CLI/prompt layer and a
  thin `ambykit fleet` wrapper), 028 and 029 import from it and keep no state or run-id logic of their
  own. The run record schema is in `data-model.md`.
- **Where state lives.** Activity markers stay per checkout (today's `.amby/activity/`). Fleet state
  (directives, claims, notes, the run record) lives in the primary checkout under `.amby/fleet/<run>/`,
  found with `primaryRoot()`, so every lane worktree sees the same files. A self-ignoring `.gitignore`
  keeps both out of version control, as 017 does for markers.
- **Edits are patches.** `tickTask` and `setStoryStatus` change one line in place under a per-file lockfile
  and a write-to-temp-then-rename, so SC-002 holds and concurrent writers in one checkout both survive
  (FR-005). Across lane worktrees, the existing `mergeCheckoffs` already unions check-offs.
- **Server entry.** `ambykit mcp` is started by the assistant from the project root (or a lane worktree);
  it reads `process.cwd()` as the checkout, uses `findProjectRoot`, and writes only protocol JSON to
  stdout (everything else to stderr).
- **Setup emission.** A new `EmittedFile.merge: "json"` splices one key (`<topLevelKey>.ambykit`) into an
  existing JSON file without touching other keys. `BaseEmitter` gets one hook, `mcpFiles(ctx)`, default
  none; only verified targets override it. `buildEmittedFiles` collects them when `config.mcp.enabled`.

## Phased approach

- **Phase 0 — Research** (`research.md`): confirm the MCP protocol revision and stdio framing from the
  official specification; confirm, per target, the file, top-level key, per-server entry shape and scope.
  `docs/tool-compatibility.md` today records the file and top-level key only. Anything not confirmed is
  recorded as "not written" (FR-018, US-6).
- **Phase 1 — Foundation:** config keys, activity marker superset, run resolution, lockfile, the JSON-RPC
  layer, the tool registry and an empty server behind `ambykit mcp`. → `data-model.md`, `contracts/`.
- **Phase 2+ — Features, in priority/dependency order:** US-1 read tools → US-2 write tools → US-3
  report and directive reading → US-7 directive writer and verb → US-6 setup emission and fallback →
  US-4 claims and notes → US-5 stall. Polish: docs, dogfooding (SC-007), performance check.

## Build order and integration (cross-plan QA)

- **Batch B step 1: build before 019.** The fleet foundation is built first: config schema (T010), the
  run record and `createRun`/`updateRun`/`resolveRun` (T012), lock (T013), directive reader and writer
  (T040, T050), claims and notes (T080, T081) and `laneStatus` (T090). Spec 019 and the 028 and 029
  plans import these; 019 must not start before them. Tasks are tagged `(batch B step 1)` in tasks.md.
- **Spec 023 before the stateful tools.** `next_task` and `lane_tasks` import `buildable` and
  `blockersOf` from `buildGraph` (023, built in batch A); `analyzeGraph` stays only as the interim
  fallback inside T020.
- **027 builds after 025.** The two share the emit, sync and types changes (025 T061, T062, T069 against
  027 T001, T021, T040), so 027 rebases on 025 and merges the sync output text by hand.
- **No golden re-records or `ambykit sync` inside a lane.** T105 (and the sync of any emitted files) is an
  integration step run once after merging the batch, never on a lane branch.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| US-1, FR-001, FR-002 | `src/core/query.ts` returns slices for `next_task`, `story_status`, `lane_tasks`, `analyze_report` from the existing parsers (`parseTasks`, `parseStories`, `analyzeProject`); unknown ids return an error naming them. |
| SC-001 | Query results are capped slices; a test asserts < 1 KB and < 10% of the source file. |
| US-2, FR-003, FR-004, FR-005 | `src/core/tasks-edit.ts`: validated one-line patches under `lock.ts`; refuses unknown/already-checked tasks and invalid statuses (lists allowed values). |
| SC-002 | Edits go through `parseTasks`-compatible regexes; a property-style test re-parses after every write. |
| US-3, FR-006, FR-009, FR-012, FR-013 | `src/core/report.ts` writes the marker (superset) and returns `{ack, directive}`; any error becomes a `warning` result, never a thrown failure. The reporting cadence (FR-013) is stated in the tool descriptions (T044) and mirrored in spec 019's worker prompt. |
| FR-007, FR-008 | One `writeMarker`; lane given ⇒ file `<feature>.<agent>~<lane>.json`; readers take the agent from the body; no lane ⇒ today's name. |
| FR-010, FR-011 | `src/core/fleet/directives.ts` reads `.amby/fleet/<run>/directives/<lane>.json` `{action, at}` in the primary checkout; missing file ⇒ continue; last write wins. |
| FR-020 | The directive result carries the action only; "finish the task, stop at next report" is worker-protocol wording (spec 019), asserted in the tool description text. |
| FR-021 | `ambykit activity` parses `--lane`, `--state`, `--run`; absent flags leave today's marker byte-identical (golden test). |
| FR-022 | `directiveStatus()` pure function over directive + lane markers: pending / pause requested / paused / obeyed. |
| FR-023, US-7 | `writeDirective` validates the lane against the run; `ambykit directive` is its CLI verb; resume writes `continue`. |
| FR-024 | `resolveRun()` returns the single unfinished run, or a warning naming the several; with no unfinished run it warns and creates nothing (no implicit run); never throws into the tool. |
| US-4, FR-015, FR-016 | `claims.ts` (overlap via `lanes.ts` `overlaps`/`normalizePath`, owner named on refusal, released by `tickTask`); `notes.ts` validates `T### | files | text`, one line. |
| US-5, FR-014 | `lane-status.ts`: stalled when state is working and both the last report and `tasks.md` mtime are older than `fleet.stallMinutes` (default 15); independent of the dashboard idle limit. |
| US-6, FR-017, FR-018, FR-019 | Opt-in `mcp.enabled`; verified targets emit project files via `merge: "json"`; user-level files only under `--include-user`; unverified targets write nothing and `sync` says why; prompts are unchanged so files-only still works. |
| SC-003 | A perf test runs `report_activity` and a directive read under the one-second budget. |
| SC-004, SC-005 | Fallback test (no prompt requires the server); lane-named markers do not overwrite each other. |
| SC-006 | Every task below owns its tests; `npm run typecheck` and `npm test` gate each phase. |
| SC-007 | Polish enables the server on this repo and a later lane uses the tools (dogfood gate). |

## Risks & decisions

- **Unverified formats.** The compatibility matrix names MCP files and top-level keys but not each
  per-server entry shape, and Antigravity's `mcp_config.json` location is not given. Phase 0 must verify
  them; until then those targets are emitted as "not written". Codex's TOML stays out of scope, as the
  matrix says.
- **`opencode.json` may contain comments.** If it does not parse as plain JSON, the merge skips it and
  reports; it never rewrites a file it cannot round-trip (Principle 7).
- **Runs are owned here.** 025 defines `.amby/fleet/<run>/run.json` (schema in `data-model.md`) and the
  functions that create and update it; a run starts only on explicit request as `<feature>.<n>` (spec
  019 FR-014). A missing record means "no run".
- **Lane names contain dots** (`NNN-slug.lane-1-1`), which breaks the existing marker-name regex. The file
  name uses the lane's short form (`lane-1-1`); the full name is in the body.
- **Spec 020/023 not landed.** "Unblocked" uses today's story `depends-on`/`blocked-by`; a `BLOCKED`
  marker (020) is honored if present. `buildGraph` (023, built first) supplies `buildable` and
  `blockersOf`; `analyzeGraph` is only the interim fallback inside T020.

### Open decisions (defaults chosen; revisit before building)

1. **Transport implementation:** hand-rolled stdio JSON-RPC (no new dependency) over
   `@modelcontextprotocol/sdk`. Reason: dependency discipline (feature 006 cap) and a tiny surface.
   Revisit if Phase 0 shows the protocol needs more than the four methods.
2. **Directive CLI verb name:** `ambykit directive <feature> <lane> pause|resume|stop [--run=<id>]`.
3. **Command written into target configs:** `ambykit mcp` (assumes it is on PATH) rather than
   `npx -y @ambystech/ambykit mcp` (avoids network exec by default, Principle 7).
4. **Opt-in switch:** `.amby/config.json` `mcp: { enabled: true }`, edited by hand or by a future
   `ambykit add`; no new `sync` flag.
5. **Marker file lane form:** short `lane-<phase>-<k>` in the file name, full name in the body.
6. **Run without `/amby.run`:** decided, no implicit run. `report_activity` with no `run` and no
   unfinished run returns a warning and creates nothing; with several unfinished runs it returns a
   warning naming them. A run is only created on request as `<feature>.<n>` (019 FR-014).
7. **Claims and notes storage:** `.amby/fleet/<run>/claims.json` (lock-guarded) and `notes.log`
   (append-only lines `T### | files | text`), both in the primary checkout.
8. **Tool names:** `next_task`, `story_status`, `lane_tasks`, `analyze_report`, `tick_task`,
   `set_story_status`, `report_activity`, `claim_file`, `post_note`, plus one added read tool,
   `lane_status` (state, stalled flag, directive status), which spec 025 US-5 and FR-022 imply.
9. **Config key:** one `fleet` object in `.amby/config.json` (`stallMinutes` 15, `restartLimit` 2,
   `concurrency {total 3, perType 2}`, `roundLimit` 3, `tickSeconds`, `budgets`, `workerModel`). 025
   T010 owns the schema and defaults; 028 extends it. `laneStatus` is the single stall implementation.
10. **Primary checkout lookup:** `primaryRoot()` (path-based) instead of parsing `git worktree list`.

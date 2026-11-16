---
feature: 019-amby-run-prompt
status: draft
created: 2026-11-16
---

# Implementation Plan — Amby run (prompt-level pipeline and team protocol)

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> Reference spec by ID — do not restate it. No UI: `/amby.design` is skipped.
> **Fleet state contract (cross-plan):** spec 025 OWNS all fleet state — code under `src/core/fleet/*` (runs,
> directives, claims, notes, lane-status, types, the `fleet` config object) and `.amby/fleet/<run>/` in the primary
> checkout. 019 owns only the PROMPT layer (run.md, worker.md, reviewer prompts, emitters), a thin `ambykit fleet`
> wrapper, pure run-flow helpers, and the review-verdict contract. **Build order:** 025 foundation (state module,
> schema, directive writer, lane-status, claims, notes, `fleet` config) and 024 T031 (Claude shell grant) land BEFORE
> 019; golden re-record and `ambykit sync` are integration steps after merge, never inside the lane.

## Technical context

- **Stack:** TypeScript (Node ≥ 20, ESM, NodeNext, `.js` import suffixes), Vitest, zod, gray-matter — all
  already in the repo. No new dependencies (Principle 2).
- **Existing pieces reused:** `CommandSpec` loader (`src/core/command-spec.ts`), `BaseEmitter` persona
  hook `roleFiles()` (`src/emitters/base-emitter.ts`), read-only role personas `amby-qa` and
  `amby-architect` (`src/roles/`), `overlaps()`/`normalizePath()` (`src/core/lanes.ts`), task parsing
  (`parseTasks`, `src/core/dashboard.ts`), activity markers (`src/core/activity.ts`), config schema
  (`src/core/config.ts`), `BaseCommand` verbs (`src/cli/`).
- **Constraints driving choices:**
  - One neutral source, emitted per tool (Principle 1): `/amby.run` is a new `src/prompts/run.md`; the write-capable
    worker persona is a new neutral file emitted only where the matrix verifies an agent format (Principle 4).
  - Token frugality (Principle 3): the prompt loads only the slice of `tasks.md` and run state a step needs; reviewers
    return finding IDs, not prose; notes are one line.
  - State is plain files readable without a model (FR-013, SC-004), so a later `ambykit run` (028) and MCP tools (025)
    can reuse the same shapes.
  - Add-only: no existing command's output changes except the new `run` entry in the generated rules summary
    (Principle 6: regenerate with `ambykit sync`).

## Architecture

```
/amby.run (src/prompts/run.md)  ── the LEAD: main session, no role, reads state via `ambykit fleet`
   │ delegates                       │ reviews (read-only personas, already emitted by 013)
   ▼                                 ▼
amby-worker (src/agents/worker.md)   amby-qa · amby-architect
   │ every write goes through one validated path
   ▼
ambykit fleet <start|status|update|claim|release|note>   (src/cli/fleet.ts, THIN wrapper, no state logic)
   │ calls
src/core/fleet/*  (OWNED BY SPEC 025: runs, directives, claims, notes, lane-status, config; `.amby/fleet/<run>/`)
src/core/fleet/run-flow.ts (019: pure run-flow helpers only: phase detection, round action, verdict parse, rebuild, overlap decision)
```

- **Lead = main session.** `run.md` has no `role:` (the lead is not one of the seven read-only roles, including spec 022's security role, FR-006).
  QA and architect reuse the existing personas; the lead asks them for findings only.
- **Worker persona.** A new neutral prompt `src/agents/worker.md` becomes a native subagent file, separate from
  `roleFiles()` so the seven review roles stay read-only (FR-006). New `BaseEmitter.workerFiles()` hook (default none), overridden
  only where the matrix verifies the agent format: Claude (`.claude/agents/amby-worker.md`, tools incl. Write/Edit/Bash,
  optional `model:`), OpenCode (`.opencode/agents/`), Copilot and Copilot CLI (`.github/agents/*.agent.md`). Model pin is
  emitted only for Claude, the one target whose agent frontmatter documents `model` (Principle 4).
- **Host capability.** `src/core/subagents.ts` is the per-target table (FR-022): each target is `confirmed` or
  `unconfirmed`. Emitters replace a new `$SUBAGENTS` token (`yes`/`no`) in the prompt, so the lead is told, per host,
  to delegate or to do worker, QA and review steps itself in sequence (FR-021, US-8). Launch value: `claude`
  `confirmed` after the live check in Phase 8; every other target `unconfirmed` (fallback) until someone confirms it.
- **Run state** is owned by spec 025: `.amby/fleet/<run>/` in the primary checkout (`primaryRoot`), `<run>` = `<feature>.<n>`,
  started only on explicit request (FR-013, FR-014). The `run.json` schema is defined ONLY in 025's `data-model.md`
  (status `active|paused|waiting-person|done`, stage `working|qa|architect`, round, limit, needsDecision, gates[], lanes[],
  approvals[], escalations[]); 019 does not define its own enum. Claims use `claims.json` and notes use `notes.log`
  (`T### | files | text`), both 025's. Decisions are recorded as `escalations[]` entries. Overlap choices (serialize or
  squad, writer per file, merge order) need a place in that schema: requested from 025 as a `lanes[]` extension (see Open
  decisions). The directory is gitignored like activity markers; rebuildable.
- **Review verdict contract (owned by 019, adopted by 028):** one file per lane, role and round,
  `.amby/fleet/<run>/verdicts/<lane>.<role>.<round>.json`, shape
  `{ "verdict": "pass" | "fail", "findings": [ { "id", "severity", "finding", "fix" } ] }`; `<lane>` uses the short
  lane form `lane-<p>-<k>`, `<role>` is `qa` or `architect`. The lead returns only the finding IDs to the same worker.
- **Pure helpers, state through 025** (AGENTS.md): `src/core/fleet/run-flow.ts` (019) is pure — `determinePhase`,
  `nextRoundAction`, `parseVerdict` (the JSON above), `rebuildFromTasks` (returns run state in 025's schema), the
  overlap-decision record. All file reads/writes, claims, notes, directives and lane status go through 025's modules; the
  CLI only prints. 025 releases a task's claims when the task is checked off (FR-017).
- **Stall and caps.** The prompt cannot measure time, so `fleet status` prints what 025's `laneStatus` computes (FR-026,
  FR-027): stalled lanes (15 minutes, no report, no `tasks.md` change), restarts left (2), free slots under
  `fleet.concurrency` (total 3, perType 2). The lead acts on that output. 019 has no stall logic of its own.
- **Pause.** `fleet update --pause|--resume|--stop` is a wrapper over 025's `writeDirective` (lane files use the short
  lane form `lane-<p>-<k>`, shape `{action, at}`); 019 never writes a directive file itself (FR-016).
- **Config** is the single `fleet` object in `.amby/config.json`, owned by spec 025 T010 (`stallMinutes`, `restartLimit`,
  `concurrency:{total:3, perType:2}`, `roundLimit:3`, `workerModel`); absent = defaults, so existing projects are unchanged
  (FR-005, FR-012, FR-026, FR-027). 019 adds no config keys of its own.
- **Reporting cadence in the prompts** (025 FR-013, FR-020): `worker.md` and `run.md` call `ambykit activity` with
  `--lane` and `--state` (025 T042) at task start, task end and when blocked or waiting, never on a timer; a paused or
  stopped worker finishes its current task and obeys at its next report.

## Phased approach

- **Phase 0 — Research (inside US-8's tasks):** live-confirm Claude Code runs the emitted `amby-worker` subagent from a
  command and record the result; check OpenCode and Copilot agent formats against `docs/tool-compatibility.md` before
  marking either `confirmed`. → notes in `docs/tool-compatibility.md`, no `research.md`.
- **Phase 1 — Setup / Foundation:** path helper, package files, pure run-flow types, a contract check against 025's
  `fleet` config and run schema, subagent table, `BaseEmitter` hooks. No data-model.md or contracts/: state shapes live in
  025's `data-model.md`; the verdict contract is in Architecture.
- **Phase 2+ — Stories in priority order:** US-1 (run from state), US-2 (workers, caps, stall), US-3 (QA), US-4
  (architect loop), US-5 (pause, inspect, resume), US-8 (degrade), then US-6 (notes and claims, P2) and US-7 (squads,
  P3). Then polish: golden fixtures, docs, `ambykit sync`, dogfood gate.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-002, FR-003 / US-1 | `determinePhase()` in `fleet/run-flow.ts` (spec status, plan, tasks, checked count); `run.md` stops before a phase whose artifact is missing or `draft`; done feature changes nothing |
| FR-004, FR-005, FR-007, FR-008 / US-2 | `run.md` delegation rules + `amby-worker`; one-line reports; BLOCKED marker per spec 020; `run.workerModel` → Claude agent `model:` |
| FR-006 | `run.md` has no role; personas stay `Read, Grep, Glob`; worker is a separate file, never produced from `roleFiles()` |
| FR-009, FR-010, FR-011 / US-3, US-4 | QA step runs the phase's `**Verify:**` line, records per 020; failure → JSON verdict file (contract above) → same worker; then architect review; `parseVerdict()` extracts finding IDs |
| FR-012, FR-024 / US-4 | `nextRoundAction(round, fleet.roundLimit)`; at the limit the lead stops, summarizes, asks, records the decision in the run's `escalations[]` (025 schema) |
| FR-013, FR-014, FR-015 / US-5 | 025's run store and `resolveRun()` (one → resume, several → ask, new only on explicit request); `rebuildFromTasks()` in `fleet/run-flow.ts` |
| FR-016 / US-5 | `fleet update --pause/--resume/--stop` wrapper calls 025's `writeDirective`; worker finishes task, obeys at next report |
| FR-017, FR-018 / US-6 | 025's claims and notes (`claims.json`, `notes.log`; release on check-off) via the `fleet claim|release|note` wrapper; unclaimed edits surface as a `fleet status` warning |
| FR-019 / US-7 | overlap choice (`serialized` or `squad` with writer-per-file and fixed order) recorded before work starts, in a `lanes[]` extension of 025's schema |
| FR-020, FR-021, FR-022 / US-8 | no MCP dependency; `$SUBAGENTS` token from `subagents.ts`; table sourced from `docs/tool-compatibility.md` |
| FR-023 | `run.md`: when `specs/<f>/tests.md` exists, QA gets it as the expected cases |
| FR-025 | prompt and worker authored once in `src/prompts/` / `src/agents/`, emitted by every emitter |
| FR-026, FR-027 | 025's `laneStatus` and `fleet.concurrency`; surfaced by `fleet status` |
| SC-001–SC-007 | tests per task; SC-005 and SC-007 are the dogfood gate (T106) |

## Risks & decisions

- **Spec 025 ordering (resolved):** 019 FR-016 routes pause through 025's directive writer and 025's foundation builds
  first, so the build order is one-way (025 state foundation, then 019, then the rest of 025). 019 has no writer of its
  own. 025's spec dependency on 019 is for its prompts and the team protocol, not for the state foundation.
- **Claude shell grant:** the prompt runs `ambykit fleet`, `ambykit activity` and `ambykit directive`; the Claude
  emitter currently grants a scoped shell for `ambykit activity` only. 024 T031 generalizes it and is built first
  (T024, T036 depend on it).
- **Integration steps:** golden re-record (T103) and `ambykit sync` (T104) run once after the batch merges, not in this lane.
- **Spec 020 not built yet:** BLOCKED markers and Verify lines come from 020 (1.4). Tasks gate on 020; until then the
  prompt treats a missing Verify line as "check acceptance criteria only" (US-3).
- **Subagent behavior is host-specific and unverified for most targets** (Principle 4): everything except Claude Code
  starts `unconfirmed` and uses the fallback, so a wrong guess cannot break a host.
- **Golden fixtures** (`test/fixtures/emitters-golden`) change for every command-surface target: re-recorded in Polish.
- **Helper CLI vs files-only:** a thin `ambykit fleet` wrapper is more than the spec names, but it gives the prompt one
  validated path to 025's core. It holds no state logic. Cost: one `BaseCommand` subclass.

## Open decisions (defaults chosen; not settled by the spec)

1. Keep the thin `ambykit fleet` wrapper (start/status/update/claim/release/note) rather than files-only: chosen, as the
   one validated path from prompts to 025's core. It holds no state logic and the user may drop it (prompts would call
   025's verbs directly).
2. Pause goes through 025's `writeDirective` only; there is no fallback writer in 019, because 025's foundation builds first.
3. Model pin only for Claude agents (the only verified `model` key); other targets ignore `run.workerModel` and `sync`
   prints a note.
4. Squads are recorded in `run.json` and the prompt; no extra worktree tooling (lanes from 015 stay the isolation unit).
5. Run state is gitignored and lives in the primary checkout (`primaryRoot`, 025); a run started in a lane worktree still
   writes there, so every host and the dashboard read one place.
6. Ask spec 025 to add the overlap-decision record (serialize or squad, writer per file, merge order) as a `lanes[]`
   extension to its run schema; until then T091 holds the record shape in `run-flow.ts` and writes it through 025's store.

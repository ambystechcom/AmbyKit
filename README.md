<p align="center">
  <img src="https://raw.githubusercontent.com/ambystechcom/AmbyKit/main/public/ambykit_logo.png" alt="AmbyKit" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ambystech/ambykit"><img src="https://img.shields.io/npm/v/@ambystech/ambykit" alt="npm version"></a>
  <a href="https://github.com/ambystechcom/AmbyKit/actions/workflows/ci.yml"><img src="https://github.com/ambystechcom/AmbyKit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://ambykit.ambystech.io/"><img src="https://img.shields.io/badge/docs-live-EE1199" alt="Docs"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520-5FA04E" alt="Node >= 20">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
</p>

# AmbyKit

**Spec-Driven Development that specs your UI too.** Most SDD frameworks take you from user stories
straight to a technical plan and leave the interface to the model's imagination. AmbyKit adds a
first-class design phase — `ui.md` plus a real `design-tokens.json` — between the *what* and the
*how*, then emits native commands and rules for every AI coding assistant your team uses.

<p align="center">
  <img src="https://raw.githubusercontent.com/ambystechcom/AmbyKit/main/public/demo.gif" alt="One ambykit init emits native commands for Claude Code, Cursor, and Copilot at once" />
</p>

## Quick start

```bash
npx @ambystech/ambykit init     # scaffold .amby/ and pick your assistants
# — or install it —
npm install -g @ambystech/ambykit
ambykit init
```

Node ≥ 20. No Python toolchain, no separate installer — it's an npm package.

Already have a project? `init` is **non-destructive** — an existing `CLAUDE.md`/`AGENTS.md` is
preserved (and backed up); AmbyKit only adds/updates its own `### AmbyKit usage` section. Re-run
`ambykit sync` any time to keep it current, or `ambykit restore` to roll a file back.

Then, inside your AI assistant, walk the workflow:

```bash
/amby.constitution   # one-time: set your project's guiding principles
/amby.specify        # describe a feature → spec.md (user stories + EARS requirements)
/amby.clarify        # resolve open questions
/amby.revise         # continue an existing spec — add and refine in place
/amby.design         # UI spec + design-tokens.json
/amby.plan           # technical plan
/amby.tasks          # ordered, dependency-aware task list
/amby.implement      # build it
/amby.converge       # verify the code against the spec; append gap tasks, repeat until converged
/amby.review         # have another role (QA, Architect, PM…) critique an artifact, findings by ID
```

Track progress from the terminal:

```bash
ambykit dashboard
ambykit dashboard 001:US-3   # story ids restart per feature — qualify with the feature ref
```

📖 Full documentation: **[ambykit.ambystech.io](https://ambykit.ambystech.io/)**

## Why

AI coding assistants build better software when they start from good requirements. AmbyKit gives you
a rigorous, tech-agnostic SDD workflow **and** a single source of truth that compiles to each tool's
native format.

- **UI is a first-class artifact.** `/amby.design` produces a UI spec plus design tokens — the part
  every other spec framework skips. Your assistant builds the interface you described, not the one
  it guessed.
- **WHAT before HOW.** `spec.md` captures user stories + testable requirements with no tech
  decisions; `plan.md` captures the technical approach separately.
- **Parallel work is built in.** `ambykit worktree` gives each feature its own git worktree, so
  several features — or several assistants — run side by side without checkout switching.
- **Author once, emit per tool.** One neutral source → Claude Code, OpenCode, GitHub Copilot
  (VS Code + CLI), Cursor (+ CLI), Antigravity (IDE + CLI), Codex CLI.

## How AmbyKit compares

The honest version. [GitHub Spec-Kit](https://github.com/github/spec-kit) is the big one in this
category and it is genuinely good — if you want the widest assistant coverage and the largest
community, use it. AmbyKit is the choice when the UI matters and you live in the Node ecosystem.

| | AmbyKit | GitHub Spec-Kit | Kiro |
|---|---|---|---|
| UI design phase + design tokens | ✅ `ui.md` + `design-tokens.json` | ❌ | ❌ (`design.md` is architecture) |
| Native git worktree isolation | ✅ `ambykit worktree` | ❌ [open issue](https://github.com/github/spec-kit/issues/1476); third-party forks | ❌ |
| Cross-role artifact review | ✅ `/amby.review`, findings by ID, `--apply` patches in place | Role "bundles" for setup, no review phase | ❌ |
| Dependency-graph dashboard | ✅ `ambykit dashboard` / `analyze` | ❌ | ❌ |
| Code-vs-spec drift check | ✅ `/amby.converge` | ✅ `/speckit.converge` | ❌ |
| Brownfield / revise in place | ✅ `/amby.revise` | ✅ evolving-specs guide | ✅ |
| EARS requirements | ✅ | ✅ | ✅ |
| **Assistants supported** | **6 families / 10 targets** | **37 integrations** | self-contained |
| Runtime | Node ≥ 20, `npx` | Python 3.11+, `uv`/`pipx` | proprietary IDE + CLI |
| License | MIT | MIT | proprietary (Crew is Apache 2.0) |
| Maturity | young, v1.1 | very large community | AWS-backed, paid tiers |

**Why not just Spec-Kit?** If breadth of assistant support is your constraint, use Spec-Kit — it
covers far more tools. Pick AmbyKit if you want the design phase, per-feature worktrees, and an
install that's one `npx` away instead of a Python toolchain.

*Comparison current as of AmbyKit v1.1.0; competitors move fast — corrections welcome via
[issue](https://github.com/ambystechcom/AmbyKit/issues) or PR.*

## The workflow

| Phase | Command | Output |
|---|---|---|
| Governance (once) | `/amby.constitution` | `.amby/constitution.md` |
| Specify (WHAT/WHY) | `/amby.specify` | `specs/NNN-feature/spec.md` |
| Clarify | `/amby.clarify` | resolves `[NEEDS CLARIFICATION]` markers |
| Revise | `/amby.revise` | continues `spec.md` / `ui.md` in place |
| **Design (UI)** | `/amby.design` | `ui.md` + `design-tokens.json` |
| Plan (HOW) | `/amby.plan` | `plan.md` (+ `data-model.md`, `contracts/`) |
| Tasks | `/amby.tasks` | `tasks.md` |
| Analyze | `/amby.analyze` | cross-artifact consistency report |
| Implement | `/amby.implement` | executes `tasks.md` |
| Converge | `/amby.converge` | checks code vs spec/plan/tasks; appends gap tasks to `tasks.md` |
| Review | `/amby.review` | cross-role critique of any artifact; `--apply` patches in place |

Requirements use **user stories** (`US-#`) + **EARS** functional requirements (`FR-###`) +
**Given/When/Then** acceptance criteria. Stories carry `priority` and `depends-on`/`blocked-by` so
work can be ordered and blocked; `ambykit dashboard` reports progress across the story/task graph.

## Supported tools

Claude Code (CLI + VS Code), GitHub Copilot (VS Code + CLI), OpenCode, Cursor (+ CLI),
Antigravity (IDE + CLI), Codex CLI. See [`docs/tool-compatibility.md`](./docs/tool-compatibility.md).

Missing yours? [Open a request](https://github.com/ambystechcom/AmbyKit/issues/new/choose) — a new
target is a thin `BaseEmitter` subclass.

## CLI

| Command | Description |
|---|---|
| `ambykit init [dir]` | Scaffold `.amby/`, pick tools, emit their files + `AGENTS.md`/`CLAUDE.md` |
| `ambykit add <tool…>` | Add/refresh one tool's integration |
| `ambykit sync` | Re-emit all configured tools from the neutral source |
| `ambykit dashboard [story-id]` | Progress view over the story/task graph |
| `ambykit analyze` | Validate the dependency graph (cycles, blockers, orphans) |
| `ambykit check` | Doctor: verify integrations |
| `ambykit restore [file]` | Restore an agent-doc file from its `.amby/backups/` backup |
| `ambykit update` | Update the CLI to the latest, then refresh this project's prompts |
| `ambykit worktree <feature>` | Isolated working copy per feature (`list`, `remove`) for parallel work |

See [`docs/cli-reference.md`](./docs/cli-reference.md).

## Contributing

AmbyKit is built with AmbyKit — see [`CONTRIBUTING.md`](./CONTRIBUTING.md),
[`AGENTS.md`](./AGENTS.md), and [`docs/contributing.md`](./docs/contributing.md).
Changes are logged in [`CHANGELOG.md`](./CHANGELOG.md). MIT licensed.

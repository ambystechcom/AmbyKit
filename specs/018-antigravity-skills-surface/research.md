# Research — 018 Antigravity skills surface

Checked 2026-11-04 against antigravity.google/docs/skills/ and
antigravity.google/docs/migration/workflows-to-skills/.

## T002 findings

- **Frontmatter:** only `name` (optional, "lowercase, hyphens for spaces", defaults to the folder name)
  and `description` (required). Matches what `skillFrontmatter` emits.
- **Location:** `<workspace-root>/.agents/skills/<skill-folder>/SKILL.md`; Antigravity also reads
  `.agents/skills/` in parent folders up to the repo root, and keeps `.agent/skills` for compatibility.
- **Slash command (CLI):** the CLI "automatically converts" a skill into a slash command; the page's
  example is `deploy-staging` → `/deploy-staging`. By that example our skills should appear as
  `/amby-specify` (dots become hyphens in `skillName`), **not** `/amby.specify`. This is an inference
  from one example, not an explicit rule. The App also accepts `/<skill-name>`.
- **IDE:** the skills page does not say IDE skills are invoked as slash commands; they are listed in
  the Customizations menu of the agent panel. The agent selects a skill from its `description`.
- **Cutoff:** "Current workflows will stop working on October 19, 2026." The guide speaks of the IDE
  and App and does not say whether the CLI is affected. Both targets move now (spec FR-015).
- **Correction to earlier notes:** neither page states that a skill wins over a same-named workflow
  (016 research and spec 018 said so). Treat it as unconfirmed; the design does not depend on it,
  because workflow output is dropped.
- **Migration command:** `/migrate-workflows` converts workflows to skills and renames the originals
  to `*.md.bak`. Those `.bak` files are not matched by the stale-file scan (it only matches
  `amby.<id>.md`).

## Consequences

- Docs must say the phases appear as `/amby-<phase>` in the Antigravity CLI and are selected by
  description in the IDE, and must not promise `/amby.specify`.
- SC-001 stays a live check (T097).

## SC-001 live check (T097) — waived 2026-11-04

The Antigravity IDE is installed on the build machine, but opening the app and listing the agent
panel's skills is a GUI step that was not driven here, and the `agy` CLI is not installed. Evidence in
its place: the emitted `SKILL.md` files match the documented layout (`name` = directory, `description`
required, project path `.agents/skills/`) and are covered by `test/antigravity-skills-018.test.ts`.
To close it: `ambykit add antigravity` in a scratch project, open it in Antigravity, confirm the
`amby-*` skills appear under Customizations, and in the CLI confirm `/amby-specify` expands its prompt
(this also settles whether the dotted name from R2 is accepted). Record the result here.

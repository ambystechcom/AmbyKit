# Migrating to the v2 spec format

AmbyKit 2.0 stores a spec's machine-read data in structured form instead of scattered bullets and trailing
parentheses. `ambykit migrate` converts your existing `spec.md` and `tasks.md` files for you, without rewriting any
prose. This page says what changes, how to run it safely, and what to do when it skips a file.

## What changes

| | 1.x | v2 |
|---|---|---|
| Story priority | `(priority: P1)` in the heading | `priority: P1` in the spec's frontmatter `stories:` list |
| Story status, `depends-on`, `blocked-by` | bullets under each heading | the same story entry in the frontmatter |
| A task's files | trailing `(src/a.ts, test/a.test.ts)` on the task line | `files:` in the phase's `yaml` block |
| A phase's Verify check and result | a `**Verify:** <check> ✓ passed` line | `verify:` (`check`, `result`, `why`) in the same block |
| Marker | no `format` key | `format: 2` in the frontmatter of both files |

Everything else stays: the prose, headings, checkboxes, `[P]` and `[US#]` tags, `⚠ BLOCKED:` and `↪ DEVIATION:`
markers on the task line, requirements, `plan.md`, `tests.md` and every ID. Plans and `tests.md` are not migrated.

```markdown
<!-- before: spec.md -->
### US-2 — Export the report  (priority: P2)
- **depends-on:** [US-1]
- **status:** in-progress

<!-- after -->
---
format: 2
stories:
  - id: US-2
    priority: P2
    status: in-progress
    depends-on: [US-1]
---
### US-2 — Export the report
```

## Migrate in four steps

1. **Commit or stash your work.** `migrate` warns, and names the files, if a file it is about to convert has
   uncommitted changes, but a clean tree makes the result easy to review and to undo with `git`.
2. **Preview.** `ambykit migrate --dry-run` writes nothing and prints, per feature, each file it would convert with
   the lines added and removed, each file it would skip and why. Add `--diff` to see every change.
3. **Migrate.** `ambykit migrate` (or `ambykit migrate 023` for one feature). Running it again changes nothing.
4. **Review and commit.** `git diff` shows the move; `ambykit analyze` and `ambykit dashboard` read the migrated
   specs exactly as before.

`migrate` only ever touches `spec.md` and `tasks.md` of **this checkout**, never another worktree. It also adds
`"schemaVersion": 2` to `.amby/config.json`, keeping every setting (including ones it does not know). A config from a
newer AmbyKit, or one that is not valid JSON, is left untouched and reported.

## It is safe by construction

- A file that is **not provably safe is left untouched and listed**, with the reason and the fix (below).
- Every conversion is **read back** through the same readers every command uses; if its meaning differs from the 1.x
  reading, the file is skipped and left as it was.
- Each file is **written once**, to a temporary file in the same directory and then renamed over the original, after
  checking that nobody changed it since it was read. Interrupt it at any point and every file is either wholly old
  or wholly new; run it again to finish.

### When it skips a file

| Skip reason | Fix |
|---|---|
| Story metadata inside a sentence (`The **status:** field…`) | put the metadata on its own bullet, or reword the sentence |
| Story metadata or task markup inside a code fence | reword or move the fenced example |
| Two `status` (or `depends-on`, …) bullets for one story | keep one |
| A heading priority that conflicts with a priority bullet | make them agree |
| Two `**Verify:**` lines in one phase | keep one |
| A task id repeated in a phase | give each task its own id |
| Mixed line endings, or a byte-order mark | make the endings consistent, or save without a BOM |
| Frontmatter that is not closed | close it with a `---` line |

Fix the file, then run `migrate` again: files already converted are skipped as `already v2`.

## A 1.x AmbyKit loses data on a v2 file

A 1.x AmbyKit reads a v2 file **without an error** but loses story statuses, dependencies, file ownership and Verify
results: its `analyze` would list every story as buildable. Upgrade every tool that reads your specs (local installs,
CI, teammates) to 2.0 **before** committing migrated files. If some must stay on 1.x for a while, use

```bash
ambykit migrate --dual-write
```

which keeps the 1.x bullets, groups and Verify lines **and** adds the v2 data, so both versions read the file. Dual-write
files are transitional: they cost about 12% more tokens and every edit must be made twice by hand, so run
`migrate` without the flag once everything is on 2.x.

## Editing a v2 file

Do not edit the `files:` and `verify:` data or a story's status by hand: one YAML typo makes a phase unreadable.
Use the writer, which works on 1.x and v2 files alike and refuses anything it cannot do safely:

```bash
ambykit edit files <feature> T### <path…>
ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<text>]
ambykit edit status <feature> US-# <status>
```

The phase prompts (`/amby.implement`, `/amby.run` and the others) use it. If a v2 file does have an error,
`ambykit analyze` names the file and line and exits non-zero.

## Timeline

- **2.0** reads 1.x and v2 files, per file, side by side (a repository can hold both, and so can its git history).
  Every command that reads 1.x files prints one line saying how many and how to migrate. Silence it with
  `"legacyWarning": false` in `.amby/config.json` or `AMBYKIT_LEGACY_WARNING=0`; it never appears in `--json`.
  `ambykit check` lists the features still on 1.x.
- **2.1** stops reading 1.x files and tells you to migrate with 2.0. It ships only once no migration issue has been
  open for a release.

## Antigravity is a plugin in 2.0

> **Takes effect when you upgrade to AmbyKit 2.0.** In 1.x Antigravity is still bundled and nothing here applies yet.

AmbyKit 2.0 keeps Claude Code, Codex, Copilot, Cursor and OpenCode (with their variants `claude-vscode`, `copilot-cli`,
`cursor-cli` and the `pi` alias) built in. **Both Antigravity targets, `antigravity` and `antigravity-cli`, move to an official
plugin.** The files it writes are identical, so a project synced with 1.x has no diff afterwards.

If your `.amby/config.json` lists either Antigravity target:

1. Install the plugin in your project: `npm install --save-exact @ambystech/ambykit-emitter-antigravity`.
2. List it, pinned to the exact installed version, next to your tools (the target ids do not change):

   ```json
   {
     "tools": ["claude", "antigravity", "antigravity-cli"],
     "plugins": { "@ambystech/ambykit-emitter-antigravity": "1.0.0" }
   }
   ```

3. Run `ambykit sync`. It writes nothing new; `ambykit check` should pass.

Until you do, `sync`, `check` and `update` name the target and print these two lines, keep syncing your other targets, exit
non-zero, and **never delete or rewrite** the files Antigravity already has. AmbyKit does not install the package or edit your
config for you. Read [plugin trust](./plugin-trust.md) first: a plugin is code that runs on your machine.

`init` and `add` list Antigravity as "official plugin, install first" and refuse it with the same lines until the plugin is
installed and listed. The files stay shared with Codex and Pi under `.agents/skills/`: removing one owner from your config
leaves them for the others.

Seven other targets (`gemini`, `llxprt`, `qwen`, `kilo`, `augment`, `windsurf`, `kiro`) stay bundled in 2.0 and print a one-line
notice naming the plugin that will replace each one once it is published. Nothing to do yet.

## Also in 2.0

- **Node 22 or newer.** An older Node exits with a message naming the required version.
- **`.amby/config.json` has a `schemaVersion`.** A config without one is read as version 1 and only `migrate`
  upgrades it.

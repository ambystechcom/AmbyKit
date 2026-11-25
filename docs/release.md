# Releasing AmbyKit 2.0

> For maintainers. How the core package `@ambystech/ambykit` goes from a release candidate to 2.0.0, the gate that must pass
> first, and the rollback plan. Spec: `specs/034-release-2-0/`. Official plugins are released separately, by their own tags
> (see [`plugins-release.md`](./plugins-release.md)); the steps that apply to every release are in
> [`contributing.md`](./contributing.md#release-checklist).

An assistant may prepare a branch, run the checks and fill evidence. **Only the release maintainer** (an npm owner of
`@ambystech/ambykit` with GitHub release rights) logs in to npm, creates releases and tags, publishes and changes dist-tags.

## Release checklist

Follow it in order. Stop at the first step that fails; nothing is waived.

1. **Preconditions.**
   - The Antigravity plugin `@ambystech/ambykit-emitter-antigravity` is published, install-tested and has its trusted publisher
     (036 T034, T035, T037). Check: `npm view @ambystech/ambykit-emitter-antigravity version`.
   - Every 2.0 feature (030 to 033, 036) is merged, and AmbyKit's own specs are migrated (030 T095), the last commit before release.
2. **Release candidate.** On a branch `release/2.0.0-rc.1`: set the version with `npm version 2.0.0-rc.1 --no-git-tag-version`,
   add the changelog heading, re-record the goldens and run `ambykit sync` twice (the second a no-op), then `npm test`. Merge it,
   then the maintainer creates the GitHub Release marked as a prerelease:

   ```bash
   gh release create v2.0.0-rc.1 --prerelease --title "v2.0.0-rc.1" --notes "Release candidate for 2.0.0"
   ```

   `publish.yml` publishes it under the `next` dist-tag (`scripts/release-tag.mjs`). Confirm `latest` did not move:

   ```bash
   npm dist-tag ls @ambystech/ambykit
   ```

3. **Try the candidate on another project.** Install `@ambystech/ambykit@next` in at least one project that is not this repository,
   migrate it and build a real feature. Record it in `specs/034-release-2-0/rc-report.md` with a `- **Project:**` and a
   `- **Date:**` line. A data-loss bug in `migrate` means a fix and a second candidate (`2.0.0-rc.2`), never a final release.
4. **Gate.** Fill each row of `specs/034-release-2-0/gate.md` (C1 to C5) with `met`, the date and the evidence, then:

   ```bash
   npm run release:check
   ```

   It names the first condition or precondition that is not met. The same check runs in `publish.yml` before a 2.0.x is published.
5. **Release branch.** Cut `release/2.0.0` from `main`: `npm version 2.0.0 --no-git-tag-version`, retitle `[Unreleased]` to
   `[2.0.0] — <date>` keeping the `Plugins:` line, goldens once, `ambykit sync` twice, then `npm run typecheck`, `npm test`,
   `node scripts/check-docs-sync.mjs`, `ambykit sync --check`, `ambykit analyze` and `ambykit trace 034`. Fill C5 with the
   branch's CI run URL.
6. **Publish.** Merge the release branch, save the `[2.0.0]` changelog block as `release-notes.md`, then:

   ```bash
   gh release create v2.0.0 --title "v2.0.0" --notes-file release-notes.md
   ```

   `publish.yml` checks the tag equals the package version, runs the gate and publishes with provenance through trusted publishing
   (no stored token) under `latest`. If provenance fails, do not publish again under another version without writing down why.
7. **Fresh-install check.** In an empty directory:

   ```bash
   npx -y @ambystech/ambykit@2.0.0 --version
   npx -y @ambystech/ambykit@2.0.0 migrate --help
   ```

   The first prints `2.0.0`. Record the result in `gate.md`.

## Rollback

Use this when a serious defect is found after 2.0.0 is published. The last 1.x version is **1.6.0**. The release maintainer runs every
command; each needs an npm owner login (`npm login`) or GitHub release rights.

1. **Point `latest` back at 1.x**, so a new install gets 1.6.0 again:

   ```bash
   npm dist-tag add @ambystech/ambykit@1.6.0 latest
   ```

2. **Deprecate 2.0.0** with a message naming the version that fixes it:

   ```bash
   npm deprecate @ambystech/ambykit@2.0.0 "Serious defect, use 2.0.1 (or 1.6.0 until it ships)"
   ```

3. **Edit the GitHub release** so readers see the problem first:

   ```bash
   gh release edit v2.0.0 --prerelease --notes "Withdrawn: <defect>. Use 2.0.1."
   ```

4. **Ship the fix as 2.0.1.** An npm version cannot be unpublished and published again: the number 2.0.0 is used for good, even if it
   is unpublished. Fix on `main`, cut `release/2.0.1`, run the gate and publish it. Then move `latest` forward with
   `npm dist-tag add @ambystech/ambykit@2.0.1 latest` (the workflow already publishes a plain version under `latest`) and update the
   deprecation message if needed.

### Projects already migrated by 2.0

A project that ran `ambykit migrate` has v2 files. **A 1.x AmbyKit reads a v2 file without an error but loses story statuses,
dependencies, file ownership and Verify results**: its `analyze` lists every story as buildable. There are two ways back to 1.x:

- **Restore from version control:** check out the spec and task files from before the migration commit
  (`git checkout <migration-commit>^ -- specs/`). 1.6.0 and 2.0 both read them.
- **Dual-write:** after restoring, run `ambykit migrate --dual-write` with 2.0 if you want the v2 data as well. It keeps the 1.x
  bullets, groups and Verify lines beside the v2 data, so 1.6.0 and 2.x both read the files. `migrate` leaves a file that is already
  v2 alone, so dual-write starts from the 1.x files, not from migrated ones.

Details are in [the migration guide](./migration.md#a-1x-ambykit-loses-data-on-a-v2-file).

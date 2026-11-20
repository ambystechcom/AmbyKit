# @ambystech/ambykit-emitter-antigravity

The official [AmbyKit](https://ambykit.ambystech.io) plugin for **Google Antigravity**: the IDE (`antigravity`) and the `agy` CLI
(`antigravity-cli`). AmbyKit 2.0 no longer bundles Antigravity; install this package to keep syncing it.

It writes the phase skills the way AmbyKit 1.x did, byte for byte: one directory per phase at `.agents/skills/<name>/SKILL.md`
with `name` and `description` (the CLI turns each into a slash command such as `/amby-specify`). The CLI target also writes the
project MCP file `.agents/mcp_config.json`; the IDE target writes none, because its project MCP location is unconfirmed.

## Install

Requires AmbyKit 2.0 or later (plugin API `^2`) and Node 22.

```sh
npm install --save-exact @ambystech/ambykit-emitter-antigravity
```

List it, pinned to the exact installed version, in `.amby/config.json`, next to the target ids you already use:

```json
{
  "tools": ["claude", "antigravity", "antigravity-cli"],
  "plugins": { "@ambystech/ambykit-emitter-antigravity": "1.0.0" }
}
```

Then run `ambykit sync`. If you synced with AmbyKit 1.x before, the second run changes nothing: the files are identical.

A plugin is code that runs on your machine: read [plugin trust](https://github.com/ambystechcom/AmbyKit/blob/main/docs/plugin-trust.md)
before you list one. AmbyKit never installs a plugin for you and never writes a user-level file without your consent.

## Shared files

Codex, Pi and both Antigravity targets write one file set under `.agents/skills/`. It is written once and carries the
highest-ranked id (`codex`, then `antigravity`, then `antigravity-cli`). Removing one owner from your config leaves the files for
the others.

## Development

This package lives in the AmbyKit repository under `plugins/antigravity/`. It has no runtime dependencies: everything comes from
the `api` argument AmbyKit passes to the factory. Its tests run with the repository's tests and compare its output with the
emitters that shipped inside AmbyKit 1.6. Release process: [`docs/plugins-release.md`](https://github.com/ambystechcom/AmbyKit/blob/main/docs/plugins-release.md).

MIT licensed.

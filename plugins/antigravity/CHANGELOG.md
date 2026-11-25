# Changelog

All notable changes to `@ambystech/ambykit-emitter-antigravity` are documented here. It follows [Semantic Versioning](https://semver.org/).

## [1.0.1]

- No code changes. First release published from GitHub Actions through npm Trusted Publishing (`publish-plugins.yml`), with provenance.

## [1.0.0]

First release (AmbyKit spec 036). Antigravity moved out of the AmbyKit core into this official plugin.

- Targets `antigravity` (IDE) and `antigravity-cli` (the `agy` CLI): the phase skills at `.agents/skills/<name>/SKILL.md`, byte for
  byte what AmbyKit 1.6's built-in emitters wrote (a test compares both, with and without roles and MCP).
- The CLI target writes the project MCP file `.agents/mcp_config.json`; the IDE target says why it writes none.
- Requires AmbyKit 2.0 or later (plugin API `^2`).

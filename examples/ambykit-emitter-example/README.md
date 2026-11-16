# ambykit-emitter-example

A worked AmbyKit emitter plugin. It is documentation, not a published package. The plugin API is
**experimental** in 1.6 (see `docs/plugin-api.md`).

- `index.js` — the plugin: one target per extension point (`BaseEmitter`, `SkillsEmitter`,
  `TomlCommandEmitter`).
- `package.json` — the metadata AmbyKit reads: the name (`ambykit-emitter-*`), the exact version and
  `ambykit.pluginApi`, the plugin-API range the plugin supports.
- `matrix-row.json` — the plugin's compatibility row, which the test kit checks the emitter against.

To try it in a project, copy this folder to `node_modules/ambykit-emitter-example`, then add to
`.amby/config.json`:

```json
{ "tools": ["example"], "plugins": { "ambykit-emitter-example": "1.0.0" } }
```

and run `ambykit sync`.

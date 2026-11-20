# ambykit-emitter-example

A worked AmbyKit emitter plugin. It is documentation, not a published package. The plugin API is
**stable** from 2.0 (see `docs/plugin-api.md` and `docs/stability.md`).

- `index.js` — the plugin: one target per extension point (`BaseEmitter`, `SkillsEmitter`,
  `TomlCommandEmitter`).
- `package.json` — the metadata AmbyKit reads: the name (`ambykit-emitter-*`), the exact version and
  `ambykit.pluginApi`, the plugin-API range the plugin supports.
- `matrix-rows.json` — one compatibility row per target, which the test kit checks each emitter against.

To try it in a project, copy this folder to `node_modules/ambykit-emitter-example`, then add to
`.amby/config.json`:

```json
{ "tools": ["example"], "plugins": { "ambykit-emitter-example": "1.0.0" } }
```

and run `ambykit sync`.

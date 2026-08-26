# TaskFlow — AmbyKit demo app

A deliberately small task board. It exists so the README demo recording has a **real project** to
run against: a `package.json`, some source, an interface with obvious room for improvement.

It is not part of the published package (`example/` is excluded from the npm `files` list) and
nothing in AmbyKit imports it.

## Run it

```bash
cd example
npm start          # http://localhost:5173
```

No dependencies — just Node ≥ 20 and a zero-dep static server.

## Its role in the demo

`scripts/demo.tape` records `ambykit init` here, so the GIF shows AmbyKit landing in a project that
already exists rather than an empty directory. The UI is intentionally plain: it's the "before" that
makes `/amby.design` — a `ui.md` plus real design tokens — worth watching.

Everything AmbyKit generates in this directory (`.amby/`, `.claude/`, `.cursor/`, `.github/`,
`specs/`, `AGENTS.md`, `CLAUDE.md`) is gitignored, so recording a take never dirties the repo.
Reset between takes with:

```bash
node scripts/demo-reset.mjs
```

Record on macOS (`brew install vhs tree`) — the tape uses the real `tree` and `head`, so every
command on camera is one a viewer can copy verbatim.

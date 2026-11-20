# Stability

What AmbyKit promises not to break, and how it changes what it promises. This page is the **contract** for two surfaces: the
`ambykit run` command and the plugin API (with its contract test kit). It is read by a test
(`test/stability-contract.test.ts`): every item in a `contract` block below is checked against the code, so this page and the
code cannot drift apart. A promise without a check is not a promise.

## What "stable" promises

Stable means a person can build on a surface and expect it to keep working across the minor releases of a major version.
A breaking change to anything listed on this page is held for the next major release (see
[Changing what is stable](#changing-what-is-stable)).

Two surfaces are covered, each listed in its own section below:

- **`run`:** the `ambykit run` command: its flags, its exit codes, the structure of the lines it prints, the layout of the
  fleet state files and the directive protocol.
- **The plugin API:** the names a plugin imports from `@ambystech/ambykit/plugin`, the shape of a plugin's descriptor, the rules
  the loader applies, and the contract test kit published as `@ambystech/ambykit/testkit`.

Anything **not listed** on this page is not covered, and changing it is not a breaking change. That includes every internal
module, the wording of messages other than the lines listed, the contents of a state file beyond the fields listed, and the
loader, registry and range-check internals. If you depend on something that is not listed, open an issue so it can be listed
(and tested) or so you can be pointed at what is.

## Additions

Additions are allowed in a minor release. A new flag, a new exported name, a new field in a state file, a new line, a new
subcommand or a new target for plugins does not break what is listed, so it can ship in any minor release, and it becomes
covered only when it is added to this page (with its check). A tool that reads these surfaces must ignore what it does not know.

## Changing what is stable

<!-- Filled by T030: the deprecation policy. -->

## The `run` surface

```contract
{ "surface": "run" }
```

## The plugin API surface

```contract
{ "surface": "plugin" }
```

## The contract test kit

```contract
{ "surface": "kit" }
```

# AmbyKit UI Design Conventions

> On-demand reference for `/amby.design`. Load this only when producing `ui.md` / `design-tokens.json`,
> so the design phase stays token-frugal.

## Wireframe notation (ASCII)

Use a compact box-drawing sketch that shows structure and hierarchy, not pixels:

```
+------------------------------------------+
| [logo]                      (Sign in)    |  <- header
+------------------------------------------+
|  H1  Reset your password                 |
|  ( email__________________________ )     |  <- text input
|  [ Send reset link ]                     |  <- primary button
|  » Back to sign in                       |  <- link
+------------------------------------------+
```

Conventions: `( … )` input, `[ … ]` button, `» …` link, `H1/H2` headings, `<- note` annotations.
Embed an `<svg>` instead when precise layout matters; keep it self-contained.

## Component spec

For each component list exactly:

- **props** — name and type (e.g. `value: string`, `onSubmit: () => void`).
- **states** — cover the full set that applies: `default, hover, focus, active, disabled, loading,
  error, empty, selected`.
- **tokens** — the semantic/component token names it consumes (never raw hex/px here).
- **behavior** — 1–3 Given/When/Then lines tied to the story's `US-#`.

## Design tokens (three tiers)

Author `design-tokens.json` so decisions compose and stay consistent:

1. **primitive** — raw values only (palette, spacing scale, radii, type). No usage meaning.
2. **semantic** — usage aliases that reference primitives: `color.action`, `color.danger`,
   `space.md`, `text.muted`.
3. **component** — per-component values that reference semantics: `button.primary.bg`.

Reference with `{tier.path}` (e.g. `"{semantic.color.action}"`). Components and `ui.md` cite semantic
or component tokens — never primitives directly.

## Accessibility checklist (WCAG AA)

- Contrast ≥ 4.5:1 for text (3:1 for large text / UI affordances).
- Every interactive element is keyboard-reachable; visible focus state defined.
- Inputs have labels; errors are announced (not color-only).
- Logical focus/tab order; landmarks/roles where structure needs them.
- Design the empty, loading, and error states — not just the happy path.

## Sign-off

The design is a draft until reviewed. On approval, `/amby.design` sets `signed_off: true` (with
reviewer + date) in the `ui.md` frontmatter; downstream phases then treat the layout, components, and
tokens as binding constraints.

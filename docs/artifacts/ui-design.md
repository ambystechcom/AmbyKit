# Artifact: `ui.md` + `design-tokens.json`

UI design is a **first-class artifact** in AmbyKit — the step most spec tools skip. Produced by
`/amby.design` from the spec, with a **sign-off gate**: once you approve it, the UI is binding for
`plan`, `tasks`, and `implement`.

## `ui.md`

Captures the interface for each relevant user story:

1. **Layout / wireframe** — ASCII sketch or embedded SVG showing structure and hierarchy.
2. **Component inventory** — each component with its props, states (default/hover/disabled/loading/
   error/empty), and the design tokens it uses.
3. **Interaction criteria** — behavior in Given/When/Then, tied back to the story's `US-#`.
4. **Content & accessibility** — copy, empty/error states, focus order, contrast, ARIA needs.

```markdown
## US-1 — Reset request form

Layout:
+------------------------------------------+
|  Reset your password                     |
|  [ email____________________ ]           |
|  ( Send reset link )                     |
|  Back to sign in                         |
+------------------------------------------+

### Component: EmailField
- props: value, onChange, invalid
- states: default, focus, invalid, disabled
- tokens: color.semantic.input.border, space.md, radius.sm

### Interaction
- Given an empty email, When "Send reset link" is pressed, Then the field shows an inline error.
```

## `design-tokens.json`

Design decisions as data, in three tiers so they compose and stay consistent
([why tiers](https://martinfowler.com/articles/design-token-based-ui-architecture.html)):

```jsonc
{
  "primitive": { "color": { "blue-600": "#2563eb" }, "space": { "4": "16px" } },
  "semantic":  { "color": { "action": "{primitive.color.blue-600}" },
                 "space": { "md": "{primitive.space.4}" } },
  "component": { "button": { "primary": { "bg": "{semantic.color.action}" } } }
}
```

- **primitive** — raw values (palette, scale). No usage meaning.
- **semantic** — usage-based aliases (`action`, `danger`, `md`).
- **component** — per-component values referencing semantic tokens.

## The sign-off gate

`/amby.design` presents the UI for review. On approval it records the sign-off in `ui.md`; later
phases treat the approved layout, components, and tokens as constraints rather than suggestions. This
keeps generated code aligned with an intentional design instead of an ad-hoc one.

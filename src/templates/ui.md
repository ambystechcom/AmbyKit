---
feature: {{FEATURE_ID}}
signed_off: false                 # set true by /amby.design after review; makes UI binding
signed_off_by: null
signed_off_date: null
---

# UI Design — {{FEATURE_TITLE}}

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder); reference them by name here.

## US-1 — {{SCREEN_OR_FLOW}}

### Layout / wireframe

```
{{ASCII_WIREFRAME_OR_SVG_REF}}
```

### Component inventory

#### {{COMPONENT_NAME}}
- **props:** {{PROPS}}
- **states:** default, hover, focus, disabled, loading, error, empty
- **tokens:** {{TOKEN_REFS}}   # e.g. color.semantic.action, space.md, radius.sm

### Interaction (Given/When/Then, tied to the story)

- Given {{CONTEXT}}, When {{ACTION}}, Then {{UI_OUTCOME}}.

### Content & accessibility

- Copy: {{COPY_NOTES}}
- Empty / error states: {{STATE_NOTES}}
- A11y: focus order, contrast (WCAG AA), ARIA roles as needed.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [ ] Reviewed and approved.

---
feature: {{FEATURE_ID}}
signed_off: false                 # set true by /amby.design after review; makes UI binding
signed_off_by: null
signed_off_date: null
---

# UI Design — {{FEATURE_TITLE}}

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder); cite them by name here, never raw values.
> Conventions: `@.amby/reference/design-conventions.md`.

## US-1 — {{SCREEN_OR_FLOW}}

### Layout / wireframe

```
{{ASCII_WIREFRAME_OR_SVG}}
```
<!-- ( ) input · [ ] button · » link · H1/H2 heading · <- annotation -->

### Component inventory

#### {{COMPONENT_NAME}}
- **props:** {{PROP}}: {{TYPE}}
- **states:** default, hover, focus, disabled, loading, error, empty   <!-- keep only those that apply -->
- **tokens:** {{SEMANTIC_OR_COMPONENT_TOKEN_NAMES}}
- **behavior:**
  - Given {{CONTEXT}}, When {{ACTION}}, Then {{UI_OUTCOME}}.

### Content & accessibility

- Copy: {{COPY_NOTES}}
- Empty / loading / error states: {{STATE_NOTES}}
- A11y (WCAG AA): contrast, keyboard reachability + visible focus, labelled inputs, logical focus order.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [ ] Reviewed and approved.

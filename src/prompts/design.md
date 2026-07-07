---
id: design
name: amby.design
description: Design the UI — wireframes, component specs, and design tokens — with a sign-off gate.
argument-hint: "[feature id, defaults to current]"
phase: design
reads: [specs/NNN-slug/spec.md]
writes: [specs/NNN-slug/ui.md, specs/NNN-slug/design-tokens.json]
allowedTools: [read, write, edit]
---

Design the UI for feature `$ARGUMENTS` (default: the current feature).

Context: read that feature's `spec.md`, the templates `@.amby/templates/ui.md` +
`@.amby/templates/design-tokens.json`, and — for detailed rules — `@.amby/reference/design-conventions.md`.
Design for the spec's user stories.

1. Write `ui.md` following the template: per story, a layout/wireframe (ASCII or embedded SVG), a
   component inventory (props + full state set + token names), interaction criteria in
   Given/When/Then tied to the `US-#`, and content/accessibility notes (WCAG AA).
2. Write/extend `design-tokens.json` in three tiers — primitive → semantic → component. In `ui.md`
   cite semantic/component token **names**, never raw values.
3. Keep the UI consistent with any constitution UX principle (cite by number).
4. **Sign-off gate:** present the design and ask the user to approve. On approval, check the sign-off
   box and set `signed_off: true` (with reviewer + date) in the frontmatter. Until then it's a draft.

Downstream phases treat a signed-off UI as binding.

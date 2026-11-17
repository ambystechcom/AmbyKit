---
feature: {{FEATURE_ID}}
created: {{DATE}}
---

# Tests — {{FEATURE_TITLE}}

> Test design, written by `/amby.tasks` before code. One case per acceptance criterion; machine-read by `ambykit analyze`.
> Case: `- [TC-###] [US-n#k] [FR-###, FR-###] auto — short name → expected outcome`
> `US-n#k` = the k-th acceptance bullet of story n (`US-n` alone = the story). `TC-###` = highest + 1, never reused or renumbered.
> Decision: `auto` by default. Manual only with a reason from the list: `manual:human-judgment`, `manual:external-system`,
> `manual:visual-check`, `manual:one-off`, and then add `; verify: <how>; record: <where the result goes>`.
> At most 15 cases per story (split the story otherwise). Name tests in code `NNN:FR-###: …` (qualified).
> Refresh: a case citing a changed criterion gets ` [stale]`; one whose criterion was removed gets ` [obsolete]` (never deleted).
> Skipped design: the file holds only `skipped: <reason>`.

## Cases

- [TC-001] [US-1#1] [FR-001] auto — {{CASE_NAME}} → {{EXPECTED}}
- [TC-002] [US-1#2] [FR-002] manual:visual-check — {{CASE_NAME}} → {{EXPECTED}}; verify: {{HOW}}; record: {{WHERE}}

## Uncovered

- FR-###: deliberately uncovered — {{REASON}}
uncovered: FR-### — {{REASON}}

## Flags

- US-n#k: too vague to test — {{REASON}}

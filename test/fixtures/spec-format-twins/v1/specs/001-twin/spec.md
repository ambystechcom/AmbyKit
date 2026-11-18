---
feature: 001-twin
title: Twin
status: in-progress
---

# Spec — Twin

## User scenarios & testing

### US-1 — First  (priority: P1)

- **Why this priority:** it is first.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

### US-2 — Second  (priority: P1)

- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** in-progress

### US-3 — Third  (priority: P2)

- **depends-on:** [US-2]
- **blocked-by:** [US-2]
- **status:** draft

### US-4 — Fourth  (priority: P3)

- **depends-on:** []
- **blocked-by:** []
- **status:** ready

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL do it.

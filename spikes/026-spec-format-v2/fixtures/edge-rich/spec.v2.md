---
feature: 900-edge-rich            # NNN-slug
title: Edge rich
status: ready
created: 2026-11-16
stories:
  - id: US-1
    priority: P1
    status: done
  - id: US-2
    priority: P2
    status: in-progress
    depends-on: [US-1, "019:US-1"]
    blocked-by: [US-1]
  - id: US-3
    priority: P3
    status: draft
  - id: US-4
---

# Spec — Edge rich

Prose that mentions **status:** done before any story must be left alone.

## User scenarios & testing

### US-1 — First story  (priority: P1)

Needs a decision [NEEDS CLARIFICATION: how many?]

- **Why this priority:** it is first.

**Acceptance criteria**
- Given a, When b, Then c.

### US-2 — Second — with dash  (priority: P2)

### US-3 — Third story

### US-4 — Fourth story

Just prose.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL do it.

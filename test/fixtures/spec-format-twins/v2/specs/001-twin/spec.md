---
format: 2
feature: 001-twin
title: Twin
status: in-progress
stories:
  - id: US-1
    priority: P1
    status: done
  - id: US-2
    priority: P1
    status: in-progress
    depends-on: [US-1]
  - id: US-3
    priority: P2
    status: draft
    depends-on: [US-2]
    blocked-by: [US-2]
  - id: US-4
    priority: P3
    status: ready
---

# Spec — Twin

## User scenarios & testing

### US-1 — First

- **Why this priority:** it is first.

### US-2 — Second

### US-3 — Third

### US-4 — Fourth

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL do it.

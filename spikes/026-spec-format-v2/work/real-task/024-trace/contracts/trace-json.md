# Contract — `ambykit trace --json`

Versioned, additive: fields are only ever added, never removed or renamed (FR-008).

```json
{
  "version": 1,
  "features": [
    {
      "feature": "019-amby-run-prompt",
      "ref": "019",
      "hasRequirements": true,
      "requirements": [
        { "id": "FR-001", "qid": "019:FR-001", "text": "…", "status": "covered",
          "tests": [{ "file": "test/x.test.ts", "line": 12, "title": "019:FR-001: …", "skipped": false }] }
      ],
      "coverage": { "covered": 3, "total": 5, "uncovered": 1, "deliberate": 1 },
      "design": { "cases": [{ "id": "TC-001", "fr": ["FR-001"], "kind": "auto", "state": "matched" }] }
    }
  ],
  "orphans":   [{ "file": "…", "line": 1, "title": "…", "cites": ["999:FR-001"] }],
  "uncited":   [{ "file": "…", "line": 1, "title": "…", "reason": "no-id" }],
  "ambiguous": [{ "file": "…", "line": 1, "title": "…", "id": "FR-004", "features": ["019", "020"] }],
  "skipped":   [{ "file": "…", "line": 1, "title": "…", "cites": ["019:FR-001"] }]
}
```

- `status` is `covered` | `uncovered` | `deliberate` (with `reason`).
- `uncited[].reason` is `no-id` | `unqualified` (a bare `FR-###` defined by exactly one feature).
- `design` is present only when the feature has a `tests.md` with cases (FR-017, FR-018); `state` is
  `matched` | `missing` | `manual`.
- `--gate` does not change the output; it only sets the exit code (1 when any requirement is `uncovered`).

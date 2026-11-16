# Contract — `ambykit graph --json` (FR-008)

Stable shape. Fields are only ever **added**; none is removed or renamed. `version` is `1` and changes only
if a field must break.

```json
{
  "version": 1,
  "nodes": [
    { "id": "905:US-1", "feature": "905-top", "story": "US-1", "title": "…", "status": "draft", "priority": "P1" }
  ],
  "edges": [
    { "from": "905:US-1", "to": "904:US-1", "kind": "depends-on" }
  ],
  "featureEdges": [
    { "from": "905-top", "to": "904-base", "via": [ { "from": "905:US-1", "to": "904:US-1", "kind": "depends-on" } ] }
  ],
  "broken": [
    { "from": "903:US-1", "to": "US9", "kind": "blocked-by", "reason": "unknown-story" }
  ],
  "cycles": [ ["901:US-1", "901:US-2"] ]
}
```

| Field | Meaning |
| --- | --- |
| `version` | Contract version, `1`. |
| `nodes[].id` | Story ID qualified by the feature's display ref (`NNN:US-#`; the directory name when two features share a number). Unique. |
| `nodes[].feature` | Feature directory (`NNN-slug`). |
| `nodes[].story` | Story ID as written (`US-1`). |
| `nodes[].title`, `status`, `priority` | From the spec; empty string when absent. |
| `edges[]` | Story edge: `from` depends on / is blocked by `to`. `kind` is `depends-on` or `blocked-by` (a dependency written in both yields one edge per kind). Only resolvable edges appear here. |
| `featureEdges[]` | Derived: feature `from` depends on feature `to` when a story in `from` has an edge to a story in `to`. `via` lists the causing story edges. Both kinds count. |
| `broken[]` | A dependency that does not resolve: `from` story, `to` as written in the spec, `kind`, and `reason`: `unknown-story` (the feature exists, or the target is a bare id) or `unknown-feature` (a `NNN:US-#` reference to a feature number that does not exist). |
| `cycles[]` | Each cycle as an ordered list of node IDs; a self-dependency is a cycle of one. |

## Guarantees

- Deterministic: identical files give identical output, whatever the directory order (FR-006). Nodes are sorted by
  feature directory then story number; edges follow each node's declaration order; `featureEdges`, `broken` and
  `cycles` are sorted by their first key.
- Local and zero model tokens (Principle 3).
- Exit status of the command is non-zero when `broken` or `cycles` is non-empty (FR-010); the JSON is still printed.

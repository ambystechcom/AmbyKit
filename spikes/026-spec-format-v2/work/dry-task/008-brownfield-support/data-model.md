# Data model — Brownfield support

Entities and invariants for the merge/classify layer. No persistence beyond files on disk.

## RulesRegion
The AmbyKit-owned span inside a rules file.
- `startLine` — index of the `### AmbyKit usage` heading.
- `endLine` — first line at same/higher heading level after start, or EOF (exclusive).
- `body` — text between bounds, normalized (`\n`, single trailing newline).
- `fingerprint` — hash embedded in the region footer (see R-2).

**Invariants**
- At most **one** RulesRegion per file (FR-004). If parsing finds >1 `### AmbyKit usage`, the file is
  treated as malformed → abort that file (FR-007).
- `body` excludes the fingerprint line when the fingerprint is computed.

## MergePlan
Result of planning a single file merge (pure; no I/O).
- `path` — project-relative rules file path.
- `action` — `created` | `updated` | `unchanged` | `skipped` | `aborted`.
- `contents?` — merged file text (absent for `unchanged`/`skipped`/`aborted`).
- `reason?` — for `skipped` (hand-edited region) / `aborted` (unreadable/malformed/encoding).
- `backupOf?` — set when an existing file will be backed up before write.

**Transitions (given existing file + fresh region)**
- file absent → `created` (whole greenfield file, FR-002).
- no region in file → `updated` (append region; preserve all prior bytes, FR-001).
- region present, fingerprint matches, body differs → `updated` (splice in place, FR-004).
- region present, fingerprint matches, body identical → `unchanged` (byte-stable, FR-010).
- region present, fingerprint mismatch → `skipped` + reason (FR-008a).
- unreadable / >1 region / non-UTF-8 → `aborted` + reason (FR-007).

## ProjectClassification
- `mode` — `greenfield` | `brownfield`.
- `signals` — subset of `{ rulesFile, sourceFiles, gitHistory }` that fired (FR-008).
- Rule: `brownfield` if `signals` non-empty **or** detection is uncertain (FR-009).

## Backup
- `path` — `.amby/backups/<originalName>.<ISO-ts>.bak`.
- `original` — the rules file it snapshots.
- Excluded from the emitted-file set → never affects `check`/`sync` (FR-010, Principle 7).

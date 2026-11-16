# Research — Brownfield support (Phase 0 decisions)

Decisions with rationale. Feeds `plan.md`; referenced by ID from tasks.

## R-1 — Region delimiter & idempotency

**Decision:** The AmbyKit-owned region is a Markdown section beginning `### AmbyKit usage`, ending at
the next heading of the same or higher level (`###`/`##`/`#`) or EOF (per FR-003). Parsing is
line-based: find the H3 marker line, then scan forward for the first line matching `^#{1,3}\s`.

**Rationale:** Pure Markdown, no hidden start/end markers, matches how the user already delimits their
docs. Line-scan is trivial and dependency-free.

**Idempotency guard:** Before comparing/writing, normalize the region to `\n` line endings with
exactly one trailing newline. Prevents CRLF / trailing-newline churn from making `check` flap
(spec edge case).

## R-2 — Skip-detection state (FR-008a)

**Options:** (a) embed a fingerprint comment in the region footer; (b) store expected region text/hash
in an external manifest under `.amby/`.

**Decision:** (a) — append `<!-- ambykit:fingerprint <hash> -->` as the last line of the region, where
`<hash>` is a short hash of the region body excluding the fingerprint line itself. On update: recompute
the hash of the current on-disk region body; if it differs from the embedded value, the user hand-edited
the region → **skip and report** (FR-008a). If it matches, splice the fresh region.

**Rationale:** Self-contained (no second source of truth to drift), survives file moves/renames, keeps
`src/core` pure. The comment sits inside the region bounds so it does not affect R-1 parsing. Hash need
not be cryptographic — collision risk is immaterial for "did a human edit this".

## R-3 — Greenfield snapshot churn

**Finding:** Adopting the `### AmbyKit usage` region changes the byte output of today's `AGENTS.md` and
Claude `CLAUDE.md` bridge, so existing emitter snapshot tests change.

**Decision:** Update the snapshots to the region layout; this is expected, not a regression. Backward
compatibility is preserved *semantically* (a fresh project still gets a complete, working rules file),
not byte-for-byte. Flagged in `plan.md` risks; escalate via `/amby.clarify` only if byte-identity is a
hard requirement.

## R-4 — Brownfield detection signals (FR-008)

**Decision:** Classify **brownfield** if ANY of:
1. a supported rules file already exists (`CLAUDE.md`, `AGENTS.md`, or another tool's rules file);
2. non-AmbyKit source files exist (any tracked/plain file outside `.amby/`, `.git/`, and AmbyKit's own
   generated paths — ignore common noise like `node_modules`, dotfiles);
3. a VCS history with commits exists.

Ambiguous/uncertain → **brownfield** (FR-009, safe default).

**git probe (no new dep):** check for `.git`, then a lightweight `git rev-parse --verify HEAD` via
`node:child_process`; treat non-zero/thrown as "no commits". Confirm during Phase 4 that the spawn is
guarded (missing git binary → treat as no history, never crash).

## R-5 — Backups (FR-008c) & sync-cleanliness (FR-010)

**Decision:** Before modifying an existing rules file, copy it to `.amby/backups/<name>.<ISO-ts>.bak`.
`.amby/backups/` is **not** part of the emitted-file set, so `check`/`sync`/CI ignore it (Principle 7).
Recommend a `.gitignore` entry for `.amby/backups/` (documented, not force-written — Principle 7).
Restore surface (US-4): list/restore most-recent backup for a given rules file.

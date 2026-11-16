# Contract — merge & classify (pure core)

Interface specs for the new `src/core` modules. Pure functions; fs/process stay at the `cli` edge
(Conventions). Types reference `@../data-model.md`.

## `src/core/merge.ts`

```ts
/** Marker that opens the AmbyKit-owned region. */
export const REGION_HEADING = "### AmbyKit usage";

/** Locate the single AmbyKit region in `text`. Returns null if absent; throws if >1 found. */
export function findRegion(text: string): RulesRegion | null;

/** Compute the fingerprint of a region body (excluding its fingerprint footer line). */
export function fingerprint(body: string): string;

/**
 * Plan a merge of `region` (a full "### AmbyKit usage …" block, fingerprint appended by the builder)
 * into `existing` (null when the target file does not exist). Pure — no I/O.
 * See MergePlan transitions in data-model.md.
 */
export function mergeRegion(existing: string | null, region: string): MergePlan;
```

**Guarantees**
- `mergeRegion` never drops bytes outside the region (FR-001); output for `unchanged` is byte-equal to
  input (FR-010).
- Idempotent: `mergeRegion(mergeRegion(x, r).contents, r).action === "unchanged"`.
- Newlines normalized to `\n`, single trailing newline, before compare/emit (R-1).

## `src/core/classify.ts`

```ts
export function classifyProject(root: string): ProjectClassification;
```

**Guarantees**
- Returns `brownfield` when any signal fires or detection is uncertain (FR-008/009).
- git probe is guarded: a missing git binary or non-repo yields `gitHistory: false`, never throws (R-4).

## Emitter / writer integration

```ts
// core/types.ts
interface EmittedFile { /* … */ merge?: "overwrite" | "region"; } // default "overwrite"

// Emitters build the region once (Principle 1) and tag rules files:
buildAmbyRegion(ctx): string;          // returns "### AmbyKit usage\n…\n<!-- ambykit:fingerprint … -->"
// → EmittedFile{ path, contents: region, scope:"project", merge:"region" }
```

**`applyFiles` (cli/fsops.ts) additions**
- `merge:"region"` files route through `mergeRegion`; write a Backup (data-model) before modifying an
  existing file (FR-008c); wrap each file in try/catch → `aborted` with reason, no partial write (FR-007).
- Claude emitter ensures the `@AGENTS.md` import is line 1 of a merged `CLAUDE.md` (FR-011).
- `WriteResult` gains `skipped`/`aborted` reason reporting and backup paths; `--dry-run` reports the
  planned `action` per file without writing (FR-008b).

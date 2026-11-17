# US-3 — readability note (T042)

Read: the migrated copies of `004-templates-and-ui-depth` (small), `014-enhanced-dashboard` (large, 119-line
tasks.md) and `020-blocked-and-verify` (uses BLOCKED and Verify), in both block layouts. One reader's
judgment, written after reading the files in an editor view; it is evidence about feel, not a measurement.

## Specs (frontmatter `stories:` block)

**Prose stayed readable.** Story sections lose three or four bookkeeping bullets each and read cleaner:
a story is now a heading, its prose, its acceptance criteria. The `**Why this priority:**`/`**Independent
test:**` bullets, which are prose, stay put. 126 stories across 26 specs.

**Where the structured data hurts**
- Status is no longer next to the story. Whoever edits a story's status (the implementer, per
  `/amby.implement`) now edits a YAML list entry at the top of the file, away from the heading they are
  working under. This is the one place a person will notice the change.
- Priority appears twice (heading text `(priority: P1)` and frontmatter). The migration copies it, so the two
  can drift. The reader warns on disagreement when it sees both, but the cleaner shape is one place.
- The whole frontmatter averages 26 lines (the 6 existing lines plus 3 or 4 per story). Scannable, and the
  YAML flow lists (`depends-on: [US-1, "019:US-1"]`) need quotes around cross-feature ids, which is a small
  papercut.

## tasks.md, per-phase layout

**Task lines got shorter and cleaner**: `- [x] [T010] Add the pure markers module`, with no trailing
path list. For a long-description task this is a clear gain.

**The cost is distance.** In `014` Phase 2 the block is 20+ rows (`T010: [...]` through `T024`), placed after
the last task, so reading "what does T017 own?" means scrolling to the block and matching ids. A person reviewing
a task list loses the at-a-glance ownership that v1's trailing `(src/...)` gives. The tasks.md grew from 119 to
230 lines.

**Verify moved into a code block.** The v1 Verify line is a bold sentence that renders as prose; the v2 line is
`check: "..."` plus `result: passed` inside a code fence. It is still readable, but the result is now a YAML
field an implementer must edit exactly (`result: passed`, `failed` plus `why`) instead of appending a glyph to a
sentence. A typo breaks the whole phase block (the reader reports the line; the data is unusable until fixed),
where in v1 a typo affects one line.

## tasks.md, per-task layout

**Ownership is local again**: each task shows its files directly under it, so no id matching. The cost is
volume: `014` tasks.md grows from 119 to 320 lines (about 2.7 times), and a list of 20 checkboxes becomes a
list of 20 three-line items interleaved with fences. It is harder to scan the checkboxes, and in a plain
text editor the fences are noise. Better for correctness and merging (see `us3-merge.md`), worse for scanning.

## Can an assistant load less than in 1.x?

- **Spec metadata: yes, a lot.** Everything a tool or assistant needs to know about story ids, status,
  priority and dependencies is in the first ~26 lines (4.5% of v1 spec.md tokens, across all specs). v1 forces a
  read of the whole file because the bullets are scattered through the prose.
- **Tasks: no.** The ownership and Verify data still live inside the phases they describe, so a reader that
  wants one phase reads that phase. A tool can skip prose and read only the blocks; an assistant using a plain
  file read cannot.
- **Net tokens** (see `us3-tokens.md`): v2 per-phase costs +3.2% over v1 across the repo (+5.8% per-task,
  +12.2% with dual-write). The spec side is a wash; the tasks side pays for fences and ids.

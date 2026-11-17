# US-3 — size and token cost per format

Tokens are approximated as characters / 4 (no tokenizer dependency). Words are whitespace-separated. Source: AmbyKit's own `specs/` at measurement time.

## 004-templates-and-ui-depth

| Format | spec.md tokens | tasks.md tokens | total tokens | total words | total chars | vs v1 (tokens) |
|---|---:|---:|---:|---:|---:|---:|
| v1 | 596 | 256 | 852 | 460 | 3410 | — |
| v2 phase layout | 614 | 297 | 911 | 486 | 3642 | +6.9% |
| v2 task layout | 614 | 317 | 931 | 493 | 3722 | +9.3% |
| v2 phase + dual-write | 624 | 346 | 970 | 501 | 3878 | +13.8% |

## 014-enhanced-dashboard

| Format | spec.md tokens | tasks.md tokens | total tokens | total words | total chars | vs v1 (tokens) |
|---|---:|---:|---:|---:|---:|---:|
| v1 | 3362 | 2792 | 6154 | 3584 | 24614 | — |
| v2 phase layout | 3370 | 3042 | 6412 | 3683 | 25647 | +4.2% |
| v2 task layout | 3370 | 3294 | 6664 | 3784 | 26656 | +8.3% |
| v2 phase + dual-write | 3492 | 3578 | 7070 | 3816 | 28279 | +14.9% |

## 020-blocked-and-verify

| Format | spec.md tokens | tasks.md tokens | total tokens | total words | total chars | vs v1 (tokens) |
|---|---:|---:|---:|---:|---:|---:|
| v1 | 3239 | 3502 | 6741 | 4026 | 26960 | — |
| v2 phase layout | 3239 | 3709 | 6948 | 4093 | 27790 | +3.1% |
| v2 task layout | 3239 | 3895 | 7134 | 4170 | 28535 | +5.8% |
| v2 phase + dual-write | 3323 | 4414 | 7737 | 4317 | 30947 | +14.8% |

## All specs (26 features)

| Format | spec.md tokens | tasks.md tokens | total tokens | vs v1 |
|---|---:|---:|---:|---:|
| v1 | 71991 | 40857 | 112848 | — |
| v2 phase layout | 72130 | 44379 | 116509 | +3.2% |
| v2 task layout | 72130 | 47258 | 119388 | +5.8% |
| v2 phase + dual-write | 74183 | 52468 | 126651 | +12.2% |

## Where the tokens go

- Story metadata: v1 stores it as bullets in prose (1961 tokens across all specs); v2 stores it in the frontmatter `stories:` block (2071 tokens). Net change: +5.6%.
- Machine blocks in tasks.md (phase layout): 11498 tokens of 44379 (25.9% of the v2 tasks files).

## Can an assistant load less in v2?

- **Spec metadata only:** the whole frontmatter is 3223 tokens across all specs, against 71991 for the v1 spec.md files that an assistant must read in full to find the same bullets: 4.5% of the cost. Per spec, frontmatter-only is a bounded read of the first ~26 lines on average.
- **Tasks:** ownership blocks sit inside their phase, so a reader that wants one phase still reads that phase; a reader that wants only ownership (lane planning) can read the 11498-token blocks rather than 44379, but only with a block-aware reader (a tool, not an assistant with a plain file read).


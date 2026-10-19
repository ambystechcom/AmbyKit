import type { Clarification } from "./overview-types.js";

const MARKER = "[NEEDS CLARIFICATION:";
const FENCE = /^\s*(```|~~~)/;
/** Inline code spans: a run of backticks, its content, and a matching run. */
const INLINE_CODE = /(`+)[\s\S]*?\1/g;

/**
 * Find open `[NEEDS CLARIFICATION: …]` markers in a spec body (feature 014, R-1). Markers inside
 * inline code or fenced code blocks are ignored — every spec quotes the marker in its template
 * instructions, and prose may mention it, so only bare markers count.
 */
export function findClarifications(content: string): Clarification[] {
  const found: Clarification[] = [];
  let inFence = false;
  content.split(/\r?\n/).forEach((raw, i) => {
    if (FENCE.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const line = raw.replace(INLINE_CODE, (m) => " ".repeat(m.length));
    let at = line.indexOf(MARKER);
    while (at !== -1) {
      const end = line.indexOf("]", at);
      const text = line.slice(at + MARKER.length, end === -1 ? undefined : end).trim();
      found.push({ line: i + 1, text });
      at = line.indexOf(MARKER, at + MARKER.length);
    }
  });
  return found;
}

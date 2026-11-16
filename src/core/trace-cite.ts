/** A test title's citation prefix (feature 024, FR-002/FR-007). */
export interface Citation {
  /** Qualified ids, `NNN:FR-###`, in order. */
  qualified: { ref: string; id: string; qid: string }[];
  /** Bare `FR-###` ids (never matched; ambiguous or unqualified). */
  bare: string[];
}

const ID = String.raw`(?:(\d+):)?(FR-\d+)`;
const PREFIX = new RegExp(String.raw`^\s*((?:${ID})(?:\s*[,\s]\s*${ID})*)\s*:`, "i");
const ONE = new RegExp(ID, "gi");

/**
 * Read the ids a title cites: it must BEGIN with one or more ids separated by `,` or space and then
 * `:` (`019:FR-004, 019:FR-005: does x`). Ids elsewhere in the title (a suffix `(FR-001)`) never cite.
 */
export function parseCitation(title: string): Citation {
  const out: Citation = { qualified: [], bare: [] };
  const m = PREFIX.exec(title);
  if (!m) return out;
  for (const hit of m[1]!.matchAll(ONE)) {
    const id = hit[2]!.toUpperCase();
    if (hit[1] === undefined) out.bare.push(id);
    else {
      const ref = hit[1].padStart(3, "0");
      out.qualified.push({ ref, id, qid: `${ref}:${id}` });
    }
  }
  return out;
}

import { parseTestDesign } from "./test-design.js";
import type { DesignInput } from "./trace-types.js";

/**
 * Designed cases of a feature (spec 021), read only through 021's `parseTestDesign` so the grammar has
 * one owner (feature 024, FR-017). Obsolete cases and a skipped design contribute nothing.
 */
export function readDesign(testsText: string): DesignInput {
  const design = parseTestDesign(testsText);
  if (design.skipped !== undefined) return { cases: [] };
  return {
    cases: design.cases
      .filter((c) => !c.obsolete)
      .map((c) => ({ id: c.id, fr: c.frs.map((f) => f.toUpperCase()), kind: c.decision.kind })),
  };
}

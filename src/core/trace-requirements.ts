import { parseTestDesign } from "./test-design.js";
import type { Requirement } from "./trace-types.js";

const FR_LINE = /^\s*(?:[-*]\s+)?\**(FR-\d+)\**\s*[:.)]?\s+(\S.*)$/;

/** Parse the `FR-###` requirement lines of a spec (one per line, at the start of the line). */
export function parseRequirements(specText: string): Requirement[] {
  const seen = new Set<string>();
  const out: Requirement[] = [];
  for (const raw of specText.split(/\r?\n/)) {
    const m = FR_LINE.exec(raw);
    if (!m || seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    out.push({ id: m[1]!, text: m[2]!.trim() });
  }
  return out;
}

/**
 * Deliberately-uncovered notes (FR-010): `uncovered: FR-### — reason` or 021's section form
 * `FR-###: deliberately uncovered — reason`, read through 021's single grammar. Works on a `tests.md`
 * or a `spec.md` (cases never match there).
 */
export function parseDeliberate(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of parseTestDesign(text).uncovered) out.set(u.fr.toUpperCase(), u.reason);
  return out;
}

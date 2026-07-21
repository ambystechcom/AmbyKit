import { createHash } from "node:crypto";
import type { MergePlan, RulesRegion } from "./types.js";

/** Options for a region merge. */
export interface MergeOptions {
  /** A line that must be the file's first line even on merge, e.g. Claude's `@AGENTS.md` bridge. */
  requiredPrefix?: string;
}

/**
 * Non-destructive region merge for brownfield rules files (feature 008).
 *
 * The AmbyKit-owned region is a Markdown section that opens with `### AmbyKit usage` and runs until
 * the next heading of the same or higher level (`#`, `##`, `###`) or end-of-file (FR-003). A short
 * fingerprint of the region's own body is embedded in a footer comment so a later run can tell
 * whether a human edited the region since AmbyKit wrote it (FR-008a).
 *
 * Pure — no file-system or process access (side effects stay at the CLI edge, per the constitution).
 */

/** Heading line that opens the AmbyKit-owned region. */
export const REGION_HEADING = "### AmbyKit usage";

const FINGERPRINT_RE = /^<!--\s*ambykit:fingerprint\s+(\S+)\s*-->\s*$/;
const HEADING_RE = /^#{1,3}\s/;

/** Normalize to LF line endings. */
function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Canonical form used for hashing/comparison: LF endings, no trailing whitespace. */
function canonical(text: string): string {
  return toLf(text).replace(/\s+$/, "");
}

/** Short, non-cryptographic-strength content fingerprint (collision risk is immaterial here). */
export function fingerprint(regionCore: string): string {
  return createHash("sha256").update(canonical(regionCore)).digest("hex").slice(0, 12);
}

/** Split a region body into its content core (heading + body, no footer) and its footer fingerprint. */
function splitFingerprint(body: string): { core: string; fingerprint: string | null } {
  const lines = toLf(body).split("\n");
  // Find the last non-empty line; if it is a fingerprint footer, peel it off.
  let last = lines.length - 1;
  while (last >= 0 && lines[last]!.trim() === "") last--;
  if (last >= 0) {
    const m = FINGERPRINT_RE.exec(lines[last]!);
    if (m) {
      return { core: canonical(lines.slice(0, last).join("\n")), fingerprint: m[1]! };
    }
  }
  return { core: canonical(body), fingerprint: null };
}

/**
 * Build a complete AmbyKit region from its core content (which must start with `REGION_HEADING`),
 * appending the fingerprint footer. The returned block ends with a single trailing newline.
 */
export function buildRegion(core: string): string {
  const body = canonical(core);
  return `${body}\n\n<!-- ambykit:fingerprint ${fingerprint(body)} -->\n`;
}

/**
 * Locate the single AmbyKit region in `text`. Returns null when absent. Throws when more than one
 * `### AmbyKit usage` heading is present (malformed — the caller aborts that file, FR-007).
 */
export function findRegion(text: string): RulesRegion | null {
  const lines = toLf(text).split("\n");
  const starts = lines.flatMap((l, i) => (l.trimEnd() === REGION_HEADING ? [i] : []));
  if (starts.length === 0) return null;
  if (starts.length > 1) {
    throw new Error(`found ${starts.length} "${REGION_HEADING}" regions; expected at most one`);
  }
  const startLine = starts[0]!;
  let endLine = lines.length;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i]!)) {
      endLine = i;
      break;
    }
  }
  const body = lines.slice(startLine, endLine).join("\n");
  return { startLine, endLine, body, fingerprint: splitFingerprint(body).fingerprint };
}

/** Ensure exactly one trailing newline. */
function withTrailingNewline(text: string): string {
  return `${text.replace(/\n+$/, "")}\n`;
}

/** Ensure `prefix` is the first line of `text`, inserting it (plus a blank line) if missing (FR-011). */
function ensurePrefix(text: string, prefix?: string): string {
  if (!prefix) return text;
  const lines = toLf(text).split("\n");
  if (lines[0]!.trim() === prefix.trim()) return text;
  return `${prefix}\n\n${text.replace(/^\n+/, "")}`;
}

/**
 * Plan a merge of `emitted` — a full greenfield rules file that contains exactly one AmbyKit region —
 * into `existing` (null when the target file does not exist). On create, `emitted` is written whole
 * (FR-002); on merge, only its `### AmbyKit usage` region is spliced into `existing`, preserving every
 * other byte (FR-001). Pure — returns a plan; the caller performs any I/O.
 */
export function mergeRegion(
  existing: string | null,
  emitted: string,
  opts: MergeOptions = {},
): MergePlan {
  const { requiredPrefix } = opts;

  // File absent → write the emitted greenfield file verbatim (FR-002).
  if (existing === null) {
    return { action: "created", contents: withTrailingNewline(toLf(emitted)) };
  }

  // Extract the fresh region from the emitted file (everything AmbyKit contributes on merge).
  let fresh: RulesRegion | null;
  try {
    fresh = findRegion(emitted);
  } catch (err) {
    return { action: "aborted", reason: (err as Error).message };
  }
  if (fresh === null) {
    return { action: "aborted", reason: `emitted content has no "${REGION_HEADING}" region` };
  }
  const freshRegion = canonical(fresh.body);

  const existingLf = toLf(existing);
  let found: RulesRegion | null;
  try {
    found = findRegion(existingLf);
  } catch (err) {
    return { action: "aborted", reason: (err as Error).message };
  }

  let mergedNoPrefix: string;
  if (found === null) {
    // No region yet: preserve every existing byte, append the region after a blank line (FR-001).
    const base = existingLf.replace(/\n+$/, "");
    mergedNoPrefix = base === "" ? freshRegion : `${base}\n\n${freshRegion}`;
  } else {
    // Region present: skip if a human edited it since AmbyKit last wrote it (FR-008a).
    const { core, fingerprint: stored } = splitFingerprint(found.body);
    if (stored !== null && fingerprint(core) !== stored) {
      return { action: "skipped", reason: "AmbyKit region was hand-edited" };
    }
    // Splice the fresh region in place; never create a second region (FR-004).
    const lines = existingLf.split("\n");
    const regionLines = freshRegion.split("\n");
    const after = lines.slice(found.endLine);
    // Keep a blank line between the region and a following heading, for readability + stable re-runs.
    const separator = after.length > 0 && HEADING_RE.test(after[0]!) ? [""] : [];
    const newLines = [...lines.slice(0, found.startLine), ...regionLines, ...separator, ...after];
    mergedNoPrefix = newLines.join("\n");
  }

  const merged = withTrailingNewline(ensurePrefix(mergedNoPrefix, requiredPrefix));
  if (merged === withTrailingNewline(existingLf)) {
    return { action: "unchanged" };
  }
  return { action: "updated", contents: merged };
}

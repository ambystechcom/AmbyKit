import { scanBlocks } from "./blocks.js";
import { readFrontmatter } from "./frontmatter.js";
import type { Format, FormatIssue } from "./model.js";

export interface Detected {
  format: Format;
  /** `format: 2` is written in the frontmatter. A v2 file without it is read as v2 and warned about (030:FR-019). */
  marker: boolean;
}

const hasMarker = (data: Record<string, unknown>): boolean => data["format"] === 2 || data["format"] === "2";

/**
 * A spec.md is v2 iff its frontmatter says `format: 2`. Story data without the marker, or frontmatter whose YAML is
 * broken but still declares `stories:`, is v2 intent: it is read as v2 so its errors surface instead of silently
 * falling back to 1.x (026:F-7).
 */
export function detectSpecFormat(text: string): Detected {
  const scratch: FormatIssue[] = [];
  const fm = readFrontmatter(text, "spec.md", scratch);
  if (hasMarker(fm.data)) return { format: 2, marker: true };
  if (Array.isArray(fm.data["stories"])) return { format: 2, marker: false };
  // a block that closes but does not parse still has its raw text: a `stories:` key there is v2 intent
  if (fm.present && /^stories\s*:/m.test(fm.raw)) return { format: 2, marker: /^format\s*:\s*["']?2["']?\s*$/m.test(fm.raw) };
  return { format: 1, marker: false };
}

/** A tasks.md is v2 iff `format: 2` is in its frontmatter or it has at least one of our yaml fences. Per file, never per project. */
export function detectTasksFormat(text: string): Detected {
  const scratch: FormatIssue[] = [];
  const fm = readFrontmatter(text, "tasks.md", scratch);
  if (hasMarker(fm.data)) return { format: 2, marker: true };
  const ours = scanBlocks(text).blocks.some((b) => b.ours);
  return { format: ours ? 2 : 1, marker: false };
}

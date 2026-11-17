import type { AttentionItem, FeatureSnapshot } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { attentionLines } from "./attention.js";
import { TOKENS } from "./tokens.js";

/**
 * Quality view (feature 024, FR-013): the uncovered requirements of every feature that has requirements,
 * then the `analyze`-class findings (graph problems, blocked tasks, failed Verify). Plain text only —
 * no glyph or color is needed to read it (FR-014). The converge gap trend belongs to spec 032.
 */
export function renderQualityView(caps: Capabilities, features: FeatureSnapshot[], findings: AttentionItem[]): string {
  const muted = (s: string): string => paintToken(caps, TOKENS.semantic.color.muted, s);
  const head = (s: string): string => paintToken(caps, TOKENS.semantic.color.text, s, true);
  const lines: string[] = [head("QUALITY"), ""];

  const withReqs = features.filter((f) => f.coverage);
  lines.push(head("UNCOVERED REQUIREMENTS"));
  const width = Math.max(1, caps.columns - 4);
  let any = false;
  for (const f of withReqs) {
    const c = f.coverage!;
    if (c.uncovered.length === 0) continue;
    any = true;
    lines.push(`${f.displayRef} ${f.dir.replace(/^\d+-/, "")}  cov ${c.covered}/${c.total}`);
    for (const u of c.uncovered) lines.push(`  ${u.id}  ${u.text}`.slice(0, width));
  }
  if (!any) lines.push(muted(withReqs.length === 0 ? "No feature has requirements to trace." : "Every requirement has a test."));

  lines.push("", head("ANALYZE FINDINGS"), ...attentionLines(caps, findings));
  return lines.join("\n");
}

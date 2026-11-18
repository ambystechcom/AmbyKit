// Convert a 1.x spec.md to v2 text (030:FR-005, FR-023). Moves metadata, never rewrites prose: story status, priority,
// depends-on and blocked-by go to frontmatter `stories:`; `format: 2` is added; `(priority: Pn)` is stripped from headings;
// every other byte, and the file's line endings, stay as they were. The caller scans the file first (safety.ts) and reads
// the result back (FR-024); this function assumes a scanned, safe input.
import { detectSpecFormat } from "../spec-format/detect.js";

const HEADING = /^#{2,4}\s+(US-?\d+)\s*[—–-]\s*(.+?)\s*$/;
const RE_STATUS = /\*\*status:\*\*\s*([a-z-]+)/i;
const RE_DEP = /\*\*depends-on:\*\*\s*(.+)$/i;
const RE_BLK = /\*\*blocked-by:\*\*\s*(.+)$/i;
const RE_PRI = /\*\*priority:\*\*\s*(P\d)/i;
const BULLET = /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i;
const PRIORITY_NOTE = /\s*\(priority:\s*P\d\)/i;

const q = (s: string): string => JSON.stringify(s);
const plain = (s: string): string => (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(s) ? s : q(s));
const rawList = (v: string): string[] =>
  v
    .replace(/^\s*\[|\]\s*$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export interface ConvertSpecOptions {
  /** Keep the 1.x bullets and heading annotations and add the v2 data beside them (026:D-7). */
  dualWrite?: boolean;
}

export interface ConvertedSpec {
  status: "converted" | "unchanged";
  /** Why a file is unchanged. */
  reason?: string;
  text: string;
  /** Frontmatter had to be created (the file had none). */
  addedFrontmatter: boolean;
  /** Each `(priority: Pn)` annotation removed from a heading, for the dry-run preview (D-4). */
  strippedHeadings: { story: string; priority: string; line: number }[];
}

interface Story {
  id: string;
  priority: string;
  status: string | null;
  dep: string[] | null;
  blk: string[] | null;
  bulletPriority: string | null;
  headingLine: number;
}

export function convertSpec(text: string, feature: string, opts: ConvertSpecOptions = {}): ConvertedSpec {
  const dual = opts.dualWrite === true;
  const unchanged = (reason: string): ConvertedSpec => ({ status: "unchanged", reason, text, addedFrontmatter: false, strippedHeadings: [] });
  if (detectSpecFormat(text).format === 2) return unchanged("already v2");

  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const fmClose = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const hasFrontmatter = fmClose > 0;
  const bodyStart = hasFrontmatter ? fmClose + 1 : 0;

  const stories: Story[] = [];
  const remove = new Set<number>();
  let cur: Story | null = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const h = HEADING.exec(line);
    if (h) {
      const note = /\(priority:\s*(P\d)\)/i.exec(h[2] ?? "");
      cur = { id: h[1] ?? "", priority: note ? (note[1] ?? "").toUpperCase() : "", status: null, dep: null, blk: null, bulletPriority: null, headingLine: i };
      stories.push(cur);
      continue;
    }
    if (!cur) continue;
    const b = BULLET.exec(line);
    if (!b) continue;
    const kind = (b[1] ?? "").toLowerCase();
    if (kind === "status") cur.status = (RE_STATUS.exec(line)?.[1] ?? "").toLowerCase();
    else if (kind === "depends-on") cur.dep = rawList(RE_DEP.exec(line)?.[1] ?? "");
    else if (kind === "blocked-by") cur.blk = rawList(RE_BLK.exec(line)?.[1] ?? "");
    else cur.bulletPriority = (RE_PRI.exec(line)?.[1] ?? "").toUpperCase();
    remove.add(i);
  }
  if (stories.length === 0) return unchanged("no stories");

  const yaml: string[] = ["stories:"];
  for (const s of stories) {
    yaml.push(`  - id: ${plain(s.id)}`);
    const pri = s.priority || s.bulletPriority;
    if (pri) yaml.push(`    priority: ${pri}`);
    if (s.status) yaml.push(`    status: ${s.status}`);
    if (s.dep && s.dep.length > 0) yaml.push(`    depends-on: [${s.dep.map(plain).join(", ")}]`);
    if (s.blk && s.blk.length > 0) yaml.push(`    blocked-by: [${s.blk.map(plain).join(", ")}]`);
  }

  const out: string[] = hasFrontmatter
    ? ["---", "format: 2", ...lines.slice(1, fmClose), ...yaml, "---"]
    : ["---", "format: 2", `feature: ${feature}`, ...yaml, "---", ""];

  const stripped: ConvertedSpec["strippedHeadings"] = [];
  let afterRun = false;
  for (let i = bodyStart; i < lines.length; i++) {
    let line = lines[i] ?? "";
    if (!dual && remove.has(i)) {
      afterRun = true;
      continue;
    }
    // a removed run that sat between two blank lines would leave two blank lines in a row
    if (afterRun && line.trim() === "" && (out[out.length - 1] ?? "").trim() === "") {
      afterRun = false;
      continue;
    }
    afterRun = false;
    const story = stories.find((s) => s.headingLine === i);
    if (!dual && story && story.priority && PRIORITY_NOTE.test(line)) {
      line = line.replace(PRIORITY_NOTE, "").replace(/\s+$/, "");
      stripped.push({ story: story.id, priority: story.priority, line: i + 1 });
    }
    out.push(line);
  }
  return { status: "converted", text: out.join(eol), addedFrontmatter: !hasFrontmatter, strippedHeadings: stripped };
}

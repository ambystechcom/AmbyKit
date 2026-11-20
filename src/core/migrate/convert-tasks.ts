// Convert a 1.x tasks.md to v2 text (030:FR-005, FR-023). Moves data, never rewrites prose: each phase's trailing
// `(file/path)` groups and its Verify line move into one fenced yaml block (`files:` and `verify:`), `format: 2` is added,
// and checkboxes, markers, headings, checkpoints and every other byte stay as they were, in the file's own line endings.
// The caller scans the file first (safety.ts) and reads the result back (FR-024); this assumes a scanned, safe input.
import { parseDeclaredPaths } from "../dashboard.js";
import { VERIFY_LINE, parseMarkers, splitResult } from "../markers.js";
import { detectTasksFormat } from "../spec-format/detect.js";

const TASK = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]\s*(.*)$/;
const q = (s: string): string => JSON.stringify(s);

export interface ConvertTasksOptions {
  /** Keep the trailing groups and Verify lines and add the v2 blocks beside them (026:D-7). */
  dualWrite?: boolean;
}

export interface ConvertedTasks {
  status: "converted" | "unchanged";
  reason?: string;
  text: string;
  /** The file had no frontmatter, so minimal frontmatter (`format: 2`) was created. */
  addedFrontmatter: boolean;
  /** Number of task lines whose ownership moved into a block. */
  filesMoved: number;
  /** Number of phases that got a `verify:` entry. */
  verifyMoved: number;
}

interface TaskInfo {
  index: number;
  id: string;
  extract: boolean;
  items: string[];
  stripped: string;
}

interface Phase {
  start: number;
  end: number;
  tasks: TaskInfo[];
  verify: number[];
}

export function convertTasks(text: string, opts: ConvertTasksOptions = {}): ConvertedTasks {
  const dual = opts.dualWrite === true;
  const unchanged = (reason: string): ConvertedTasks => ({ status: "unchanged", reason, text, addedFrontmatter: false, filesMoved: 0, verifyMoved: 0 });
  if (detectTasksFormat(text).format === 2) return unchanged("already v2");

  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const fmClose = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const hasFrontmatter = fmClose > 0;

  const phases: Phase[] = [];
  let cur: Phase | null = null;
  for (let i = hasFrontmatter ? fmClose + 1 : 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (/^##\s+/.test(l)) {
      cur = { start: i, end: lines.length, tasks: [], verify: [] };
      const prev = phases[phases.length - 1];
      if (prev) prev.end = i;
      phases.push(cur);
      continue;
    }
    if (!cur) continue;
    const tm = TASK.exec(l);
    if (tm) {
      const rest = tm[3] ?? "";
      const pm = parseMarkers(rest);
      const own = parseDeclaredPaths(pm.body);
      const extract = own.paths.length > 0 || own.pathIssue === "glob";
      const info: TaskInfo = { index: i, id: tm[2] ?? "", extract, items: [], stripped: l };
      if (extract) {
        const g = /\(([^()]*)\)\s*$/.exec(pm.body);
        if (g) {
          info.items = (g[1] ?? "")
            .split(",")
            .map((x) => x.replace(/`/g, "").trim())
            .filter(Boolean);
          const prefix = l.slice(0, l.length - rest.length);
          const tail = pm.body === rest ? "" : rest.slice(pm.body.length).trimStart();
          info.stripped = prefix + pm.body.slice(0, g.index).trimEnd() + (tail ? ` ${tail}` : "");
        } else info.extract = false;
      }
      cur.tasks.push(info);
    } else if (VERIFY_LINE.test(l)) cur.verify.push(i);
  }
  for (const p of phases) if (p.verify.length > 1) return unchanged("a phase has more than one Verify line");

  const replace = new Map<number, string[]>();
  const insertAfter = new Map<number, string[]>();
  let filesMoved = 0;
  let verifyMoved = 0;
  for (const p of phases) {
    const verifyAt = p.verify[0];
    const verifyLines: string[] = [];
    if (verifyAt !== undefined) {
      const raw = VERIFY_LINE.exec(lines[verifyAt] ?? "")?.[1] ?? "";
      const { check, result, why } = splitResult(raw);
      verifyLines.push("verify:", `  check: ${q(check)}`);
      if (result) verifyLines.push(`  result: ${result}`);
      if (result === "failed") verifyLines.push(`  why: ${q(why ?? "")}`);
      verifyMoved += 1;
    }
    const owned = p.tasks.filter((t) => t.extract);
    const body: string[] = [];
    if (owned.length > 0) body.push("files:", ...owned.map((t) => `  ${t.id}: [${t.items.map(q).join(", ")}]`));
    body.push(...verifyLines);
    if (body.length === 0) continue;
    const block = ["```yaml", ...body, "```"];
    if (verifyAt !== undefined) {
      if (dual) insertAfter.set(verifyAt, block);
      else replace.set(verifyAt, block);
    } else {
      let last = p.end - 1;
      while (last > p.start && (lines[last] ?? "").trim() === "") last--;
      insertAfter.set(last, ["", ...block]);
    }
    if (!dual) {
      for (const t of owned) replace.set(t.index, [t.stripped]);
      filesMoved += owned.length;
    } else filesMoved += owned.length;
  }

  const body: string[] = [];
  lines.forEach((l, i) => {
    const r = replace.get(i);
    if (r) body.push(...r);
    else body.push(l);
    const after = insertAfter.get(i);
    if (after) body.push(...after);
  });
  const out = hasFrontmatter ? ["---", "format: 2", ...body.slice(1)] : ["---", "format: 2", "---", "", ...body];
  return { status: "converted", text: out.join(eol), addedFrontmatter: !hasFrontmatter, filesMoved, verifyMoved };
}

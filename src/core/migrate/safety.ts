// Migrate safety (030:FR-006, FR-024, SC-010). A file `migrate` cannot convert provably is left untouched and listed
// with its reason; every conversion is read back through the real readers and must reproduce the model of the 1.x file.
import { createHash } from "node:crypto";
import { readSpec, readSpecV1, readTasks, readTasksV1 } from "../spec-format/dispatch.js";
import type { PhaseVerify, StoryProgress, TaskLine } from "../spec-format/model.js";

/** Why a file is left alone. `kind` is stable; `reason` is the sentence shown to the person; `fix` says what to do. */
export interface Unsafe {
  kind: string;
  reason: string;
  fix: string;
}

export const HEADING = /^#{2,4}\s+(US-?\d+)\s*[—–-]\s*(.+?)\s*$/;
export const RE_STATUS = /\*\*status:\*\*\s*([a-z-]+)/i;
export const RE_DEP = /\*\*depends-on:\*\*\s*(.+)$/i;
export const RE_BLK = /\*\*blocked-by:\*\*\s*(.+)$/i;
export const RE_PRI = /\*\*priority:\*\*\s*(P\d)/i;
export const BULLET = /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i;
export const TASK = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]\s*(.*)$/;
export const VERIFY = /^\s*(?:-\s*)?\*\*Verify:\*\*\s*(.*?)\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

const skip = (kind: string, reason: string, fix: string): Unsafe => ({ kind, reason, fix });

/** `\n`, `\r\n`, or null when the file mixes both. */
export function eolOf(text: string): "\r\n" | "\n" | null {
  const crlf = /\r\n/.test(text);
  const bare = /(^|[^\r])\n/.test(text);
  if (crlf && bare) return null;
  return crlf ? "\r\n" : "\n";
}

/** 0-based indexes of lines inside a code fence (backtick or tilde), fences included. */
export function fencedLines(lines: string[]): Set<number> {
  const set = new Set<number>();
  let open: string | null = null;
  lines.forEach((l, i) => {
    const m = FENCE.exec(l);
    if (open) {
      set.add(i);
      if (m && (m[1] ?? "")[0] === open[0] && (m[1] ?? "").length >= open.length && l.trim() === m[1]) open = null;
    } else if (m) {
      open = m[1] ?? null;
      set.add(i);
    }
  });
  return set;
}

/** Frontmatter bounds of a 1.x file: 0-based index of the closing `---` line, or -1 when none, or null when unclosed. */
export function frontmatterEnd(lines: string[]): number | null {
  if (lines[0] !== "---") return -1;
  const close = lines.indexOf("---", 1);
  return close === -1 ? null : close;
}

const common = (text: string): Unsafe | null => {
  if (text.charCodeAt(0) === 0xfeff) return skip("bom", "file starts with a byte-order mark", "save the file without a BOM, then run migrate again");
  if (eolOf(text) === null) return skip("mixed-eol", "mixed line endings (CRLF and LF)", "make the line endings consistent, then run migrate again");
  return null;
};

/**
 * Pre-conversion scan of a 1.x spec.md (FR-006): BOM, mixed line endings, an unclosed frontmatter, story metadata that is
 * prose or inside a code fence or repeated, a key the 1.x reader would not have read, and a conflicting priority.
 */
export function scanSpec(text: string): Unsafe | null {
  const c = common(text);
  if (c) return c;
  const lines = text.split(/\r?\n/);
  const fmEnd = frontmatterEnd(lines);
  if (fmEnd === null) return skip("frontmatter-unclosed", "frontmatter is not closed with ---", "close the frontmatter with a --- line");
  const raw = fmEnd > 0 ? lines.slice(1, fmEnd).join("\n") : "";
  if (/^stories\s*:/m.test(raw)) return skip("stories-key", "frontmatter has a `stories` key that is not a list; refusing to overwrite", "fix or remove the key");
  const fenced = fencedLines(lines);
  const seen = new Map<string, Set<string>>();
  let cur: { id: string; priority: string } | null = null;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const h = HEADING.exec(line);
    if (h) {
      if (fenced.has(i)) return skip("fenced-heading", `story heading inside a code fence (line ${i + 1})`, "move the heading out of the fence or reword it");
      const p = /\(priority:\s*(P\d)\)/i.exec(h[2] ?? "");
      cur = { id: h[1] ?? "", priority: p ? (p[1] ?? "").toUpperCase() : "" };
      seen.set(cur.id, new Set());
      continue;
    }
    if (!cur) continue;
    if (![RE_STATUS, RE_DEP, RE_BLK, RE_PRI].some((r) => r.test(line))) continue;
    if (fenced.has(i)) return skip("fenced-metadata", `story metadata inside a code fence (line ${i + 1})`, "reword or move the fenced example");
    const b = BULLET.exec(line);
    if (!b) {
      return skip("prose-metadata", `story metadata inside prose, not a bullet (line ${i + 1}): moving it would change the sentence`, "put the metadata on its own bullet or reword the sentence");
    }
    const keys = [RE_STATUS, RE_DEP, RE_BLK, RE_PRI].filter((r) => r.test(line)).length;
    if (keys !== 1) return skip("multi-key-line", `line ${i + 1} carries more than one metadata key`, "put each key on its own bullet");
    const kind = (b[1] ?? "").toLowerCase();
    const set = seen.get(cur.id) as Set<string>;
    if (set.has(kind)) {
      return skip("duplicate-bullet", `${cur.id} has two ${kind} bullets (line ${i + 1}); the 1.x reader keeps the last, which a move would hide`, `keep one ${kind} bullet`);
    }
    set.add(kind);
    if (kind === "priority") {
      const v = (RE_PRI.exec(line)?.[1] ?? "").toUpperCase();
      if (cur.priority && cur.priority !== v) {
        return skip("conflicting-priority", `${cur.id}: heading priority ${cur.priority} conflicts with bullet ${v} (line ${i + 1})`, "make the heading and the bullet agree");
      }
    }
  }
  return null;
}

/** Pre-conversion scan of a 1.x tasks.md (FR-006): BOM, mixed endings, markup in a fence, two Verify lines, a repeated task id. */
export function scanTasks(text: string): Unsafe | null {
  const c = common(text);
  if (c) return c;
  const lines = text.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const phases: { verify: number; ids: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    const isHeading = /^##\s+/.test(l);
    const tm = TASK.exec(l);
    const isVerify = VERIFY.test(l);
    if (fenced.has(i)) {
      if (isHeading || tm || isVerify) {
        return skip("fenced-markup", `task, phase or Verify markup inside a code fence (line ${i + 1})`, "reword or move the fenced example");
      }
      continue;
    }
    if (isHeading) {
      phases.push({ verify: 0, ids: [] });
      continue;
    }
    const cur = phases[phases.length - 1];
    if (!cur) continue;
    if (tm) cur.ids.push(tm[2] ?? "");
    else if (isVerify) cur.verify += 1;
  }
  for (const [k, p] of phases.entries()) {
    if (p.verify > 1) return skip("duplicate-verify", `phase ${k + 1} has ${p.verify} Verify lines; migrating would have to pick one`, "keep one Verify line per phase");
    if (new Set(p.ids).size !== p.ids.length) {
      return skip("duplicate-task-id", `phase ${k + 1} repeats a task id; ownership keyed by id would be ambiguous`, "give every task in a phase its own id");
    }
  }
  return null;
}

/** Content hash used to detect an edit between read and write (FR-024). */
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// ── read-back: the converted file must give the model of the 1.x file ─────────────────────────────

const stripGroup = (desc: string, t: Pick<TaskLine, "paths" | "pathIssue">): string =>
  t.paths.length === 0 && t.pathIssue !== "glob" ? desc : desc.replace(/\s*\([^()]*\)\s*$/, "").trim();

const storyView = (s: StoryProgress) => ({ id: s.id, title: s.title, priority: s.priority, status: s.status, dependsOn: s.dependsOn, blockedBy: s.blockedBy });
const taskView = (t: TaskLine, strip: boolean) => ({
  id: t.id,
  done: t.done,
  story: t.story,
  description: strip ? stripGroup(t.description, t) : t.description,
  phase: t.phase,
  parallel: t.parallel,
  paths: t.paths,
  pathIssue: t.pathIssue,
  blocked: t.blocked,
  deviation: t.deviation,
});
const phaseView = (p: PhaseVerify) => ({ phase: p.phase, title: p.title, tasks: p.tasks, check: p.check, result: p.result, why: p.why, duplicates: p.duplicates });

function diff(label: string, a: unknown, b: unknown, out: string[]): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${label} differs`);
}

/** Differences between the 1.x spec model and the model the readers give for the converted text (empty = equal). */
export function specReadBack(feature: string, before: string, after: string): string[] {
  const out: string[] = [];
  const a = readSpecV1(feature, before).map(storyView);
  const r = readSpec(feature, after, { file: "spec.md" });
  for (const i of r.issues) if (i.severity === "error") out.push(`${i.file}:${i.line} ${i.message}`);
  diff("stories", a, r.stories.map(storyView), out);
  return out;
}

/** Same for tasks.md: tasks (ownership included) and every phase's Verify data. */
export function tasksReadBack(before: string, after: string): string[] {
  const out: string[] = [];
  const a = readTasksV1(before);
  const r = readTasks(after, { file: "tasks.md" });
  for (const i of r.issues) if (i.severity === "error") out.push(`${i.file}:${i.line} ${i.message}`);
  diff("tasks", a.tasks.map((t) => taskView(t, true)), r.tasks.map((t) => taskView(t, false)), out);
  diff("phases", a.phases.map(phaseView), r.phases.map(phaseView), out);
  return out;
}

// The writer (030:FR-020, 026:R-2): set a task's files, a story's status or a phase's Verify result in the carrier that
// belongs to the file's format, change nothing else, and refuse anything it cannot do safely. Implementers and assistants
// call it (`ambykit edit …`) instead of hand-editing YAML, so one typo cannot make a whole phase unreadable.
//
// Edits are targeted line edits on the text, never a re-serialization, so diffs stay minimal, comments and prose survive,
// and the file's own line endings are kept. Every edit is read back through the real readers: the new text must differ
// from the old only in the one field that was asked for, otherwise the edit is refused and nothing is written.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { canonicalStoryId, parseDeclaredPaths } from "../dashboard.js";
import { VERIFY_LINE, parseMarkers, splitResult } from "../markers.js";
import { scanBlocks, type Block } from "./blocks.js";
import { detectSpecFormat, detectTasksFormat } from "./detect.js";
import { readFrontmatter } from "./frontmatter.js";
import { readSpec, readTasks } from "./dispatch.js";
import type { FormatIssue, StoryProgress, TaskLine } from "./model.js";

export const WRITER_STATUSES = ["draft", "ready", "in-progress", "blocked", "done"] as const;
export const WRITER_RESULTS = ["passed", "failed", "unverified"] as const;
export type WriterResult = (typeof WRITER_RESULTS)[number];

export type EditOutcome = { ok: true; text: string; summary: string } | { ok: false; error: string };

const refuse = (error: string): EditOutcome => ({ ok: false, error });
const GLOB = /[*?[\]{}]/;
const q = (s: string): string => JSON.stringify(s);

function split(text: string): { lines: string[]; eol: string } {
  return { lines: text.split(/\r?\n/), eol: /\r\n/.test(text) ? "\r\n" : "\n" };
}

/** A path the writer accepts: no glob, no whitespace, no separators the 1.x group could not carry, and path-shaped. */
function pathProblem(p: string): string | null {
  if (p.length === 0) return "an empty path";
  if (GLOB.test(p)) return `\`${p}\` is a glob; ownership must name files`;
  if (/[\s,()`"']/.test(p)) return `\`${p}\` has whitespace or a character a file list cannot carry`;
  if (!/[/.]/.test(p)) return `\`${p}\` does not look like a file path`;
  return null;
}

const errorsOf = (issues: FormatIssue[]): FormatIssue[] => issues.filter((i) => i.severity === "error");
const describeErrors = (issues: FormatIssue[]): string =>
  errorsOf(issues)
    .slice(0, 3)
    .map((i) => `${i.file}:${i.line} ${i.message}`)
    .join("; ");

// ── tasks.md: files and Verify ───────────────────────────────────────────────────────────────────

interface TaskCtx {
  task: TaskLine;
  format: 1 | 2;
}

function findTask(text: string, taskId: string): TaskCtx | string {
  const r = readTasks(text, { file: "tasks.md" });
  if (r.format === 2 && errorsOf(r.issues).length > 0) return `fix the file first: ${describeErrors(r.issues)}`;
  const id = taskId.toUpperCase();
  const hits = r.tasks.filter((t) => t.id === id);
  if (hits.length === 0) return `unknown task ${taskId}`;
  if (hits.length > 1) return `${id} is defined ${hits.length} times; ownership by id would be ambiguous`;
  return { task: hits[0] as TaskLine, format: r.format };
}

/** The ours-blocks of the phase whose number is `phase` (blocks carry the `##` ordinal, not the phase number). */
function blocksOfPhase(text: string, phaseNumber: number): { blocks: Block[]; lines: string[]; ordinal: number } {
  const phases = readTasks(text).phases;
  const idx = phases.findIndex((p) => p.phase === phaseNumber);
  const ordinal = idx + 1;
  const { lines, blocks } = scanBlocks(text);
  return { blocks: blocks.filter((b) => b.ours && !b.unclosed && b.ordinal === ordinal), lines, ordinal };
}

/** 0-based line indexes of a block's body. */
const bodyRange = (b: Block): [number, number] => [b.start, b.end - 2];

function sameModel(label: string, before: unknown, after: unknown, out: string[]): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) out.push(`${label} changed`);
}

/** Read the edit back: only the asked-for task's ownership may differ. */
function checkFilesEdit(before: string, after: string, taskId: string, paths: string[]): string | null {
  const a = readTasks(before, { file: "tasks.md" });
  const b = readTasks(after, { file: "tasks.md" });
  if (errorsOf(b.issues).length > 0) return `the result would not read back: ${describeErrors(b.issues)}`;
  const diffs: string[] = [];
  const mask = (t: TaskLine): unknown => ({ ...t, paths: undefined, pathIssue: undefined, description: undefined });
  sameModel("other tasks", a.tasks.filter((t) => t.id !== taskId).map(mask), b.tasks.filter((t) => t.id !== taskId).map(mask), diffs);
  sameModel("the task's other fields", a.tasks.filter((t) => t.id === taskId).map(mask), b.tasks.filter((t) => t.id === taskId).map(mask), diffs);
  sameModel("phases", a.phases, b.phases, diffs);
  const want = parseDeclaredPaths(`(${paths.join(", ")})`).paths;
  const got = b.tasks.find((t) => t.id === taskId)?.paths ?? [];
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`the task would read ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
  return diffs.length > 0 ? `refused, the edit would change more than asked (${diffs.join("; ")})` : null;
}

/** Set a task's declared files. The same call edits the phase block in v2 and the trailing group in 1.x. */
export function setTaskFiles(text: string, taskId: string, paths: string[]): EditOutcome {
  if (paths.length === 0) return refuse("give at least one file path");
  for (const p of paths) {
    const problem = pathProblem(p);
    if (problem) return refuse(`refused: ${problem}`);
  }
  const found = findTask(text, taskId);
  if (typeof found === "string") return refuse(found);
  const id = found.task.id;
  const { lines, eol } = split(text);
  let next: string[] | null = null;

  if (found.format === 1) {
    const re = new RegExp(`^(\\s*-\\s*\\[[ xX]\\]\\s*\\[${id}\\]\\s*)(.*)$`);
    const i = lines.findIndex((l) => re.test(l));
    if (i === -1) return refuse(`unknown task ${taskId}`);
    const m = re.exec(lines[i] as string) as RegExpExecArray;
    const rest = m[2] ?? "";
    const pm = parseMarkers(rest);
    const tail = pm.body === rest ? "" : rest.slice(pm.body.length).trimStart();
    const group = /\(([^()]*)\)\s*$/.exec(pm.body);
    const body = group ? pm.body.slice(0, group.index).trimEnd() : pm.body;
    const line = `${m[1]}${body} (${paths.join(", ")})${tail ? ` ${tail}` : ""}`;
    next = [...lines];
    next[i] = line;
  } else {
    const task = found.task;
    const { blocks, ordinal } = blocksOfPhase(text, task.phase);
    const taskLine = lines.findIndex((l) => new RegExp(`^\\s*-\\s*\\[[ xX]\\]\\s*\\[${id}\\]`).test(l));
    const entry = `${id}: [${paths.map(q).join(", ")}]`;
    const perTask = blocks.find((b) => b.followsTask === id && /^files\s*:\s*\[/m.test(b.src));
    const phaseBlock = blocks.find((b) => /^files\s*:\s*$/m.test(b.src));
    if (perTask) {
      const [from, to] = bodyRange(perTask);
      const at = lines.findIndex((l, k) => k >= from && k <= to && /^\s*files\s*:/.test(l));
      next = [...lines];
      next[at] = `${perTask.indent}files: [${paths.map(q).join(", ")}]`;
    } else if (phaseBlock) {
      const [from, to] = bodyRange(phaseBlock);
      const ind = phaseBlock.indent;
      const body = lines.slice(from, to + 1);
      const filesAt = body.findIndex((l) => /^\s*files\s*:\s*$/.test(l.slice(ind.length)) || /^files\s*:\s*$/.test(l.slice(ind.length)));
      const entryRe = new RegExp(`^${ind}(\\s+)${id}\\s*:`);
      const hit = body.findIndex((l) => entryRe.test(l));
      const out = [...body];
      if (hit !== -1) {
        const pad = (entryRe.exec(body[hit] as string)?.[1]) ?? "  ";
        let end = hit + 1;
        while (end < body.length && /^\s/.test((body[end] as string).slice(ind.length)) && !new RegExp(`^${ind}${pad}\\S`).test(body[end] as string)) end++;
        out.splice(hit, end - hit, `${ind}${pad}${entry}`);
      } else {
        // add after the last entry of the files section, before the next top-level key
        let last = filesAt;
        for (let k = filesAt + 1; k < body.length; k++) {
          const l = (body[k] as string).slice(ind.length);
          if (l.trim() === "") continue;
          if (/^\s/.test(l)) last = k;
          else break;
        }
        out.splice(last + 1, 0, `${ind}  ${entry}`);
      }
      next = [...lines.slice(0, from), ...out, ...lines.slice(to + 1)];
    } else {
      // no files block yet: add `files:` to the phase's block (before `verify:`), or create a block after the phase's last line
      const anyBlock = blocks[0];
      if (anyBlock) {
        const [from, to] = bodyRange(anyBlock);
        const ind = anyBlock.indent;
        const body = lines.slice(from, to + 1);
        next = [...lines.slice(0, from), `${ind}files:`, `${ind}  ${entry}`, ...body, ...lines.slice(to + 1)];
      } else {
        const heads: number[] = [];
        lines.forEach((l, k) => /^##\s+/.test(l) && heads.push(k));
        const start = heads[ordinal - 1] ?? taskLine;
        const end = heads[ordinal] ?? lines.length;
        let last = end - 1;
        while (last > start && (lines[last] as string).trim() === "") last--;
        next = [...lines.slice(0, last + 1), "", "```yaml", "files:", `  ${entry}`, "```", ...lines.slice(last + 1)];
      }
    }
  }
  const after = (next as string[]).join(eol);
  const bad = checkFilesEdit(text, after, id, paths);
  if (bad) return refuse(bad);
  return { ok: true, text: after, summary: `${id} files set: ${paths.join(", ")}` };
}

function checkVerifyEdit(before: string, after: string, phase: number, result: WriterResult, why: string): string | null {
  const a = readTasks(before, { file: "tasks.md" });
  const b = readTasks(after, { file: "tasks.md" });
  if (errorsOf(b.issues).length > 0) return `the result would not read back: ${describeErrors(b.issues)}`;
  const diffs: string[] = [];
  sameModel("tasks", a.tasks, b.tasks, diffs);
  sameModel("other phases", a.phases.filter((p) => p.phase !== phase), b.phases.filter((p) => p.phase !== phase), diffs);
  const was = a.phases.find((p) => p.phase === phase);
  const now = b.phases.find((p) => p.phase === phase);
  sameModel("the phase's check", was?.check, now?.check, diffs);
  if (now?.result !== result) diffs.push(`the phase would read ${String(now?.result)}, not ${result}`);
  if (result === "failed" && (now?.why ?? "") !== why) diffs.push("the reason would not read back");
  return diffs.length > 0 ? `refused, the edit would change more than asked (${diffs.join("; ")})` : null;
}

/** Record a phase's Verify result (`passed`, `failed` with a reason, `unverified`). The phase must already have a Verify check. */
export function setVerifyResult(text: string, phase: number, result: string, why = ""): EditOutcome {
  if (!(WRITER_RESULTS as readonly string[]).includes(result)) return refuse(`invalid result \`${result}\` (use ${WRITER_RESULTS.join(", ")})`);
  const res = result as WriterResult;
  const r = readTasks(text, { file: "tasks.md" });
  if (r.format === 2 && errorsOf(r.issues).length > 0) return refuse(`fix the file first: ${describeErrors(r.issues)}`);
  const ph = r.phases.find((p) => p.phase === phase);
  if (!ph) return refuse(`unknown phase ${phase}`);
  if (ph.check === undefined) return refuse(`phase ${phase} has no Verify check to record a result against`);
  const reason = res === "failed" ? why.trim() : "";
  const { lines, eol } = split(text);
  let next: string[];

  if (r.format === 1) {
    let current = 0;
    let at = -1;
    let seen = -1;
    for (let k = 0; k < lines.length; k++) {
      if (/^##\s+/.test(lines[k] as string)) {
        current += 1;
        continue;
      }
      if (VERIFY_LINE.test(lines[k] as string) && r.phases[current - 1]?.phase === phase && seen === -1) {
        seen = k;
        at = k;
      }
    }
    if (at === -1) return refuse(`phase ${phase} has no Verify line`);
    const line = lines[at] as string;
    const m = /^(\s*(?:-\s*)?\*\*Verify:\*\*\s*)(.*?)\s*$/.exec(line) as RegExpExecArray;
    const check = splitResult(m[2] ?? "").check;
    const suffix = res === "passed" ? "✓ passed" : res === "failed" ? `✗ failed${reason ? `: ${reason}` : ""}` : "? unverified";
    next = [...lines];
    next[at] = `${m[1]}${check} ${suffix}`;
  } else {
    const { blocks } = blocksOfPhase(text, phase);
    const vb = blocks.find((b) => /^verify\s*:/m.test(b.src));
    if (!vb) return refuse(`phase ${phase} has no verify block`);
    const [from, to] = bodyRange(vb);
    const ind = vb.indent;
    const body = lines.slice(from, to + 1);
    const vAt = body.findIndex((l) => /^verify\s*:\s*$/.test(l.slice(ind.length)));
    if (vAt === -1) return refuse(`phase ${phase}: the verify entry is not a mapping the writer can edit`);
    let vEnd = vAt + 1;
    while (vEnd < body.length && (/^\s/.test((body[vEnd] as string).slice(ind.length)) || (body[vEnd] as string).trim() === "")) vEnd++;
    const entries = body.slice(vAt + 1, vEnd);
    const childIndent = /^(\s+)/.exec((entries.find((l) => l.trim() !== "") ?? "  ").slice(ind.length))?.[1] ?? "  ";
    const kept = entries.filter((l) => !/^\s*(result|why)\s*:/.test(l.slice(ind.length)));
    const add = [`${ind}${childIndent}result: ${res}`, ...(res === "failed" ? [`${ind}${childIndent}why: ${q(reason)}`] : [])];
    const checkAt = kept.findIndex((l) => /^\s*check\s*:/.test(l.slice(ind.length)));
    kept.splice(checkAt === -1 ? kept.length : checkAt + 1, 0, ...add);
    const out = [...body.slice(0, vAt + 1), ...kept, ...body.slice(vEnd)];
    next = [...lines.slice(0, from), ...out, ...lines.slice(to + 1)];
  }
  const after = next.join(eol);
  const bad = checkVerifyEdit(text, after, phase, res, reason);
  if (bad) return refuse(bad);
  return { ok: true, text: after, summary: `phase ${phase} Verify ${res}${reason ? `: ${reason}` : ""}` };
}

// ── spec.md: story status ────────────────────────────────────────────────────────────────────────

function storiesOf(text: string, feature: string): { stories: StoryProgress[]; format: 1 | 2; issues: FormatIssue[] } {
  const r = readSpec(feature, text, { file: "spec.md" });
  return { stories: r.stories, format: r.format, issues: r.issues };
}

function checkStatusEdit(before: string, after: string, feature: string, storyId: string, status: string): string | null {
  const a = storiesOf(before, feature);
  const b = storiesOf(after, feature);
  if (errorsOf(b.issues).length > 0) return `the result would not read back: ${describeErrors(b.issues)}`;
  const diffs: string[] = [];
  const mask = (s: StoryProgress): unknown => ({ ...s, status: undefined });
  sameModel("other stories", a.stories.filter((s) => s.id !== storyId).map((s) => ({ ...s })), b.stories.filter((s) => s.id !== storyId).map((s) => ({ ...s })), diffs);
  sameModel("the story's other fields", a.stories.filter((s) => s.id === storyId).map(mask), b.stories.filter((s) => s.id === storyId).map(mask), diffs);
  if (b.stories.find((s) => s.id === storyId)?.status !== status) diffs.push("the status would not read back");
  return diffs.length > 0 ? `refused, the edit would change more than asked (${diffs.join("; ")})` : null;
}

/** Set a story's status in frontmatter (v2) or its `**status:**` bullet (1.x). `feature` is the directory name. */
export function setStoryStatus(text: string, feature: string, storyRef: string, status: string): EditOutcome {
  if (!(WRITER_STATUSES as readonly string[]).includes(status)) return refuse(`invalid status \`${status}\` (use ${WRITER_STATUSES.join(", ")})`);
  const id = canonicalStoryId(storyRef);
  const before = storiesOf(text, feature);
  if (before.format === 2 && errorsOf(before.issues).length > 0) return refuse(`fix the file first: ${describeErrors(before.issues)}`);
  const story = before.stories.find((s) => s.id === id);
  if (!story) return refuse(`unknown story ${storyRef}`);
  const { lines, eol } = split(text);
  let next: string[];

  if (before.format === 2) {
    const fm = readFrontmatter(text, "spec.md", []);
    if (!fm.present) return refuse("the frontmatter is missing; the writer cannot edit story data");
    const from = fm.start - 1;
    const to = fm.end - 2;
    let entryAt = -1;
    for (let k = from; k <= to; k++) {
      const m = /^(\s*)-\s*id:\s*["']?([A-Za-z]+-?\d+)["']?\s*$/.exec(lines[k] as string);
      if (m && canonicalStoryId(m[2] ?? "") === id) {
        entryAt = k;
        break;
      }
    }
    if (entryAt === -1) return refuse(`story ${storyRef} is not in the frontmatter stories`);
    const dash = /^(\s*)-\s*id:/.exec(lines[entryAt] as string);
    const keyIndent = `${(dash?.[1] ?? "")}  `;
    let entryEnd = entryAt + 1;
    while (entryEnd <= to && !/^\s*-\s*id:/.test(lines[entryEnd] as string) && (/^\s/.test(lines[entryEnd] as string) || (lines[entryEnd] as string).trim() === "")) entryEnd++;
    while (entryEnd > entryAt + 1 && (lines[entryEnd - 1] as string).trim() === "") entryEnd--;
    next = [...lines];
    const sAt = lines.findIndex((l, k) => k > entryAt && k < entryEnd && /^\s*status\s*:/.test(l));
    if (sAt !== -1) next[sAt] = `${/^(\s*)/.exec(lines[sAt] as string)?.[1] ?? keyIndent}status: ${status}`;
    else next.splice(entryEnd, 0, `${keyIndent}status: ${status}`);
  } else {
    const headRe = new RegExp(`^#{2,4}\\s+${story.displayId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const h = lines.findIndex((l) => headRe.test(l));
    if (h === -1) return refuse(`story ${storyRef} has no heading`);
    let end = lines.length;
    for (let k = h + 1; k < lines.length; k++) {
      if (/^#{2,4}\s+/.test(lines[k] as string)) {
        end = k;
        break;
      }
    }
    next = [...lines];
    const sAt = lines.findIndex((l, k) => k > h && k < end && /\*\*status:\*\*\s*[a-z-]+/i.test(l));
    if (sAt !== -1) next[sAt] = (lines[sAt] as string).replace(/(\*\*status:\*\*\s*)[a-z-]+/i, `$1${status}`);
    else {
      let last = h;
      for (let k = h + 1; k < end; k++) if (/^\s*[-*]\s+\*\*(depends-on|blocked-by|priority|why this priority):\*\*/i.test(lines[k] as string)) last = k;
      next.splice(last + 1, 0, `- **status:** ${status}`);
    }
  }
  const after = next.join(eol);
  const bad = checkStatusEdit(text, after, feature, id, status);
  if (bad) return refuse(bad);
  return { ok: true, text: after, summary: `${story.displayId} status set: ${status}` };
}

export function formatOf(kind: "spec" | "tasks", text: string): 1 | 2 {
  return kind === "spec" ? detectSpecFormat(text).format : detectTasksFormat(text).format;
}

// ── applying to a file, with read-back and restore ─────────────────────────────────────────────────

/**
 * Read `file`, apply `edit` to its text, write the result, then read the file back from disk; if what is on disk is not
 * exactly the edited text (an editor or a concurrent writer got in between), put the original text back and refuse.
 */
export function applyEdit(file: string, edit: (text: string) => EditOutcome): EditOutcome {
  if (!existsSync(file)) return refuse(`${file} not found`);
  const original = readFileSync(file, "utf8");
  const out = edit(original);
  if (!out.ok || out.text === original) return out;
  writeFileSync(file, out.text, "utf8");
  if (readFileSync(file, "utf8") !== out.text) {
    writeFileSync(file, original, "utf8");
    return refuse(`${file} changed while it was being written; the original was restored, nothing was changed`);
  }
  return out;
}

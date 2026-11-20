/**
 * Task-line markers and per-phase Verify lines (feature 020). Pure and IO-free: `parseTasks` calls
 * `parseMarkers` on the text after the task id, and `parsePhases` reads the Verify line of each phase.
 * Markers are the trailing segment of a task line, after the `(file/path)` group, so a reason that
 * contains parentheses or backticks can never be read as file ownership.
 */

/** Result of cutting the trailing markers off a task line's text. */
export interface ParsedMarkers {
  /** The line text before the first marker (the input, untouched, when there is none). */
  body: string;
  /** BLOCKED reason(s) joined with ` | `; `""` = marker present with no reason. Undefined = not blocked. */
  blocked?: string;
  /** DEVIATION note(s) joined with ` | `. */
  deviation?: string;
}

type MarkerKind = "blocked" | "deviation";

interface Hit {
  kind: MarkerKind;
  /** Where the marker (including its optional glyph) starts. */
  start: number;
  /** Where its text starts, after `KEYWORD:`. */
  textStart: number;
}

const KEYWORD = /(?:(⚠|↪)\s*)?(?<![\w-])(BLOCKED|DEVIATION):/g;

/** `[start, end)` ranges covered by backtick code spans, so documented examples are not markers. */
function codeSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      i += 1;
      continue;
    }
    let run = 1;
    while (text[i + run] === "`") run += 1;
    const fence = "`".repeat(run);
    const close = text.indexOf(fence, i + run);
    if (close === -1) {
      i += run;
      continue;
    }
    spans.push([i, close + run]);
    i = close + run;
  }
  return spans;
}

function findMarkers(text: string): Hit[] {
  const spans = codeSpans(text);
  const inSpan = (pos: number): boolean => spans.some(([a, b]) => pos >= a && pos < b);
  const hits: Hit[] = [];
  for (const m of text.matchAll(KEYWORD)) {
    const start = m.index ?? 0;
    if (inSpan(start) || inSpan(start + m[0].length - 1)) continue;
    hits.push({
      kind: (m[2] ?? "").toUpperCase() === "BLOCKED" ? "blocked" : "deviation",
      start,
      textStart: start + m[0].length,
    });
  }
  return hits;
}

/**
 * Cut `⚠ BLOCKED: <reason>` and `↪ DEVIATION: <note>` (glyphs optional) off the end of a task line.
 * A marker's text runs to the next marker or the end of the line. Several markers of one kind are
 * joined with ` | `. Keywords inside backtick code spans are ignored, so prose that documents the
 * syntax is not read as a marker.
 */
export function parseMarkers(rest: string): ParsedMarkers {
  const hits = findMarkers(rest);
  const first = hits[0];
  if (!first) return { body: rest };

  const blocked: string[] = [];
  const deviation: string[] = [];
  let sawBlocked = false;
  let sawDeviation = false;
  hits.forEach((h, i) => {
    const end = hits[i + 1]?.start ?? rest.length;
    const text = rest.slice(h.textStart, end).trim();
    if (h.kind === "blocked") {
      sawBlocked = true;
      if (text) blocked.push(text);
    } else {
      sawDeviation = true;
      if (text) deviation.push(text);
    }
  });

  const out: ParsedMarkers = { body: rest.slice(0, first.start).trimEnd() };
  if (sawBlocked) out.blocked = blocked.join(" | ");
  if (sawDeviation) out.deviation = deviation.join(" | ");
  return out;
}

/** N from a `## Phase N` heading text, else the 1-based `##` ordinal (the rule `parseTasks` always used). */
export function phaseNumber(heading: string, ordinal: number): number {
  const n = /^Phase\s+(\d+)/i.exec(heading);
  return n ? Number(n[1]) : ordinal;
}

export type VerifyResult = "passed" | "failed" | "unverified";

/** The Verify line of one phase (feature 020 FR-005). */
export interface PhaseVerify {
  /** Same numbering as `TaskLine.phase`. */
  phase: number;
  /** Heading text after `## `. */
  title: string;
  /** Task lines in the phase; a phase is only verifiable when this is above zero. */
  tasks: number;
  /** The check, without its result suffix; undefined when the phase has no Verify line. */
  check?: string;
  /** Last recorded result; undefined = no result recorded yet. */
  result?: VerifyResult;
  /** Reason after `✗ failed:`; may be empty. */
  why?: string;
  /** Further Verify lines in the same phase; only the first is used. */
  duplicates: number;
}

export const VERIFY_LINE = /^\s*(?:-\s*)?\*\*Verify:\*\*\s*(.*?)\s*$/;
const RESULT_SUFFIX = /(?:^|\s)(✓\s*passed|passed|✗\s*failed(?::\s*.*)?|failed:\s*.*|\?\s*unverified|unverified)\s*$/i;

/** Split a Verify line's value into the check and its result suffix (`✓ passed`, `✗ failed: <why>`, `? unverified`). */
export function splitResult(value: string): { check: string; result?: VerifyResult; why?: string } {
  const m = RESULT_SUFFIX.exec(value);
  if (!m || m.index === undefined) return { check: value };
  const token = m[1] ?? "";
  const check = value.slice(0, m.index).trim();
  if (/passed$/i.test(token)) return { check, result: "passed" };
  if (/unverified$/i.test(token)) return { check, result: "unverified" };
  return { check, result: "failed", why: (/failed:\s*(.*)$/i.exec(token)?.[1] ?? "").trim() };
}

/** Per-phase Verify lines of a tasks.md body, numbered exactly as `parseTasks` numbers phases. */
export function parsePhases(content: string): PhaseVerify[] {
  const taskRe = /^\s*-\s*\[[ xX]\]\s*\[T\d+\]/;
  const phases: PhaseVerify[] = [];
  let current: PhaseVerify | null = null;
  let headings = 0;
  for (const line of content.split(/\r?\n/)) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      headings += 1;
      const title = (h[1] ?? "").trim();
      current = { phase: phaseNumber(title, headings), title, tasks: 0, duplicates: 0 };
      phases.push(current);
      continue;
    }
    if (!current) continue; // a Verify line outside any phase belongs to nothing
    if (taskRe.test(line)) {
      current.tasks += 1;
      continue;
    }
    const v = VERIFY_LINE.exec(line);
    if (!v) continue;
    if (current.check !== undefined) {
      current.duplicates += 1;
      continue;
    }
    const { check, result, why } = splitResult(v[1] ?? "");
    current.check = check;
    if (result) current.result = result;
    if (why !== undefined) current.why = why;
  }
  return phases;
}

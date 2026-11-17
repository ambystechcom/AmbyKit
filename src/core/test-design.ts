/**
 * Test design (feature 021): the single grammar for a feature's `tests.md`, shared by `analyze` and
 * by spec 024's `trace`. Pure and IO-free: callers read the files and pass the text.
 *
 * Case line:  `- [TC-001] [US-1#2] [FR-001, FR-003] auto — name → expected outcome`
 * Manual:     `… manual:visual-check — name → expected; verify: how; record: where`
 * Suffixes:   ` [stale]` (criterion changed) and ` [obsolete]` (criterion removed; the case is kept).
 * Uncovered:  `- FR-009: deliberately uncovered — reason`  OR  `uncovered: FR-009 — reason`.
 * Flag:       `- US-2#3: too vague to test — reason`.
 * Skip:       the file's only content line is `skipped: <reason>`.
 */

/** Fixed reasons a case may be manual (FR-006). */
export const MANUAL_REASONS = ["human-judgment", "external-system", "visual-check", "one-off"] as const;

/** A story that needs more cases than this is split (US-1). */
export const MAX_CASES_PER_STORY = 15;

export type TestDecision =
  | { kind: "auto" }
  | { kind: "manual"; reason: string; verify?: string; record?: string };

export interface TestCase {
  /** `TC-###`, upper-cased. */
  id: string;
  /** Raw criterion references as written: `US-n#k` (k-th acceptance bullet of story n) or `US-n`. */
  criteria: string[];
  /** Raw requirement ids as written (`FR-###`). */
  frs: string[];
  decision: TestDecision;
  name: string;
  expected: string;
  stale: boolean;
  obsolete: boolean;
  /** 1-based line in the file. */
  line: number;
}

export interface DeliberateUncovered {
  fr: string;
  reason: string;
  line: number;
}

export interface DesignFlag {
  /** `US-n#k` or `US-n`. */
  ref: string;
  reason: string;
  line: number;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface TestDesign {
  /** The skip reason when the file is a skip form; undefined otherwise (cases are then empty). */
  skipped?: string;
  cases: TestCase[];
  uncovered: DeliberateUncovered[];
  flags: DesignFlag[];
  /** Malformed lines; `checkTestDesign` reports them as `bad-line`. */
  issues: ParseIssue[];
}

const DASH = "(?:—|–|-)";
const CASE_RE = new RegExp(
  `^-\\s+\\[(TC-\\d+)\\]\\s+\\[([^\\]]*)\\]\\s+\\[([^\\]]*)\\]\\s+(auto|manual(?::([A-Za-z-]+))?)\\s*${DASH}\\s*(.+)$`,
  "i",
);
const UNCOVERED_SECTION_RE = new RegExp(`^(?:-\\s+)?(FR-\\d+)\\s*:\\s*deliberately uncovered\\s*${DASH}\\s*(.+)$`, "i");
const UNCOVERED_LINE_RE = new RegExp(`^(?:-\\s+)?uncovered:\\s*(FR-\\d+)\\s*${DASH}\\s*(.+)$`, "i");
const FLAG_RE = /^-\s+(US-\d+(?:#\d+)?)\s*:\s*(.+)$/i;
const SKIP_RE = /^skipped:\s*(.+)$/i;
const SECTION_RE = /^##\s+(\w+)/;

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}

/** Remove the YAML frontmatter block; returns the remaining lines with their 1-based numbers. */
function bodyLines(text: string): Array<{ n: number; text: string }> {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  if (raw[0]?.trim() === "---") {
    const end = raw.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) start = end + 1;
  }
  return raw.slice(start).map((t, i) => ({ n: start + i + 1, text: t }));
}

function lastMatch(text: string, re: RegExp): { start: number; end: number } | undefined {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let found: { start: number; end: number } | undefined;
  for (let m = g.exec(text); m; m = g.exec(text)) {
    found = { start: m.index, end: m.index + m[0].length };
    if (m[0].length === 0) g.lastIndex += 1;
  }
  return found;
}

function parseCase(m: RegExpMatchArray, line: number): TestCase | undefined {
  const [, id, criteria, frs, decisionRaw, reasonRaw, restRaw] = m;
  if (!id || decisionRaw === undefined || restRaw === undefined) return undefined;
  let rest = restRaw.trim();
  let stale = false;
  let obsolete = false;
  for (;;) {
    const flag = /\s*\[(stale|obsolete)\]\s*$/i.exec(rest);
    if (!flag) break;
    if (flag[1]?.toLowerCase() === "stale") stale = true;
    else obsolete = true;
    rest = rest.slice(0, flag.index).trimEnd();
  }
  let record: string | undefined;
  let verify: string | undefined;
  const rec = lastMatch(rest, /;\s*record:\s*/i);
  if (rec) {
    record = rest.slice(rec.end).trim();
    rest = rest.slice(0, rec.start);
  }
  const ver = lastMatch(rest, /;\s*verify:\s*/i);
  if (ver) {
    verify = rest.slice(ver.end).trim();
    rest = rest.slice(0, ver.start);
  }
  const arrow = /→|\s->\s/.exec(rest);
  const name = (arrow ? rest.slice(0, arrow.index) : rest).trim();
  const expected = arrow ? rest.slice(arrow.index + arrow[0].length).trim() : "";

  const isManual = decisionRaw.toLowerCase().startsWith("manual");
  const decision: TestDecision = isManual
    ? {
        kind: "manual",
        reason: (reasonRaw ?? "").toLowerCase(),
        ...(verify ? { verify } : {}),
        ...(record ? { record } : {}),
      }
    : { kind: "auto" };
  return {
    id: id.toUpperCase(),
    criteria: splitList(criteria ?? ""),
    frs: splitList(frs ?? ""),
    decision,
    name,
    expected,
    stale,
    obsolete,
    line,
  };
}

/**
 * Parse a `tests.md`. Never throws; malformed case lines are collected in `issues`. Both spellings of
 * "deliberately uncovered" are accepted and returned identically.
 */
export function parseTestDesign(text: string): TestDesign {
  const lines = bodyLines(text);
  const design: TestDesign = { cases: [], uncovered: [], flags: [], issues: [] };

  const content = lines.filter((l) => {
    const t = l.text.trim();
    return t !== "" && !t.startsWith("#") && !t.startsWith(">");
  });
  const only = content.length === 1 ? content[0] : undefined;
  const skip = only ? SKIP_RE.exec(only.text.trim()) : null;
  if (skip) {
    design.skipped = (skip[1] ?? "").trim();
    return design;
  }

  let section = "";
  for (const { n, text: raw } of lines) {
    const line = raw.trim();
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = (sec[1] ?? "").toLowerCase();
      continue;
    }
    if (line === "" || line.startsWith("#") || line.startsWith(">")) continue;

    const unc = UNCOVERED_SECTION_RE.exec(line) ?? UNCOVERED_LINE_RE.exec(line);
    if (unc) {
      design.uncovered.push({ fr: (unc[1] ?? "").toUpperCase(), reason: (unc[2] ?? "").trim(), line: n });
      continue;
    }
    if (SKIP_RE.test(line)) {
      design.issues.push({ line: n, message: "`skipped:` must be the only content line of tests.md" });
      continue;
    }
    if (/^-\s+\[TC-/i.test(line) || (section === "cases" && line.startsWith("- "))) {
      const m = CASE_RE.exec(line);
      const c = m ? parseCase(m, n) : undefined;
      if (c) design.cases.push(c);
      else design.issues.push({ line: n, message: `case line does not match the format: ${line.slice(0, 60)}` });
      continue;
    }
    if (section === "flags") {
      const f = FLAG_RE.exec(line);
      if (f) design.flags.push({ ref: (f[1] ?? "").toUpperCase(), reason: (f[2] ?? "").trim(), line: n });
      else if (line.startsWith("- ")) design.issues.push({ line: n, message: `flag line does not match the format: ${line.slice(0, 60)}` });
    }
  }
  return design;
}

/** The next free case id: highest existing number + 1, obsolete cases included, never reused. */
export function nextCaseId(design: TestDesign): string {
  let max = 0;
  for (const c of design.cases) {
    const n = Number(c.id.slice(3));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `TC-${String(max + 1).padStart(3, "0")}`;
}

/** What the checker needs to know about a spec: its stories, their acceptance bullets and its FRs. */
export interface SpecIdIndex {
  /** Story number -> number of acceptance bullets. */
  criteria: Map<number, number>;
  /** `FR-###` ids defined in the spec (upper-case). */
  frs: string[];
  /** The `status:` value from the frontmatter, if any. */
  status?: string;
}

/** Read the ids a spec defines. Tolerant: a spec with no acceptance criteria yields empty counts. */
export function extractSpecIds(specText: string): SpecIdIndex {
  const lines = specText.replace(/\r\n/g, "\n").split("\n");
  const criteria = new Map<number, number>();
  const frs: string[] = [];
  let status: string | undefined;
  let story: number | undefined;
  let inCriteria = false;
  let inFront = lines[0]?.trim() === "---";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (inFront) {
      if (i > 0 && line.trim() === "---") inFront = false;
      else {
        const s = /^status:\s*([\w-]+)/.exec(line);
        if (s) status = s[1];
      }
      continue;
    }
    const heading = /^###\s+US-(\d+)\b/.exec(line);
    if (heading) {
      story = Number(heading[1]);
      criteria.set(story, 0);
      inCriteria = false;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      inCriteria = false;
      if (!/^###\s+US-/.test(line)) story = undefined;
      continue;
    }
    if (/^\*\*Acceptance criteria\*\*/.test(line)) {
      inCriteria = true;
      continue;
    }
    if (inCriteria && story !== undefined && /^-\s/.test(line)) {
      criteria.set(story, (criteria.get(story) ?? 0) + 1);
      continue;
    }
    const fr = /^-\s+(FR-\d+)\b/.exec(line);
    if (fr?.[1] && !frs.includes(fr[1])) frs.push(fr[1].toUpperCase());
  }
  return { criteria, frs, ...(status ? { status } : {}) };
}

export type DesignFindingKind =
  | "bad-line"
  | "duplicate-case"
  | "unknown-id"
  | "uncovered-fr"
  | "uncovered-criterion"
  | "bad-decision"
  | "missing-verify"
  | "too-many-cases"
  | "stale-case";

export interface DesignFinding {
  kind: DesignFindingKind;
  message: string;
  /** The id the finding is about (case, FR, or criterion reference), when there is one. */
  ref?: string;
  /** 1-based line in tests.md, when there is one. */
  line?: number;
}

const CRITERION_RE = /^US-(\d+)(?:#(\d+))?$/;

/** Does `ref` (`US-n` or `US-n#k`) exist in the spec? */
function criterionExists(ref: string, ids: SpecIdIndex): boolean {
  const m = CRITERION_RE.exec(ref);
  if (!m) return false;
  const count = ids.criteria.get(Number(m[1]));
  if (count === undefined) return false;
  if (m[2] === undefined) return true;
  const k = Number(m[2]);
  return k >= 1 && k <= count;
}

/**
 * Check a parsed test design against its spec (FR-004..FR-009, FR-013). A skip form is valid and
 * yields no findings. Findings are non-blocking: callers must not change an exit status for them.
 */
export function checkTestDesign(specText: string, design: TestDesign): DesignFinding[] {
  if (design.skipped !== undefined) return [];
  const ids = extractSpecIds(specText);
  const findings: DesignFinding[] = [];
  const add = (f: DesignFinding) => findings.push(f);

  for (const issue of design.issues) add({ kind: "bad-line", message: issue.message, line: issue.line });

  const seen = new Set<string>();
  for (const c of design.cases) {
    if (seen.has(c.id)) add({ kind: "duplicate-case", message: `${c.id} is used more than once`, ref: c.id, line: c.line });
    seen.add(c.id);
  }

  const live = design.cases.filter((c) => !c.obsolete);
  for (const c of live) {
    for (const ref of c.criteria) {
      if (!criterionExists(ref, ids)) add({ kind: "unknown-id", message: `${c.id} cites ${ref}, which the spec does not have`, ref, line: c.line });
    }
    for (const fr of c.frs) {
      if (!ids.frs.includes(fr)) add({ kind: "unknown-id", message: `${c.id} cites ${fr}, which the spec does not have`, ref: fr, line: c.line });
    }
    if (!c.name || !c.expected) {
      add({ kind: "bad-line", message: `${c.id} needs a short name and an expected outcome (name → expected)`, ref: c.id, line: c.line });
    }
    if (c.decision.kind === "manual") {
      const reason = c.decision.reason;
      if (!(MANUAL_REASONS as readonly string[]).includes(reason)) {
        add({
          kind: "bad-decision",
          message: `${c.id} is manual with ${reason ? `reason "${reason}"` : "no reason"}; use one of ${MANUAL_REASONS.join(", ")}`,
          ref: c.id,
          line: c.line,
        });
      }
      if (!c.decision.verify || !c.decision.record) {
        add({ kind: "missing-verify", message: `${c.id} is manual: add \`verify:\` and \`record:\``, ref: c.id, line: c.line });
      }
    }
    if (c.stale) add({ kind: "stale-case", message: `${c.id} cites a criterion that changed; refresh it`, ref: c.id, line: c.line });
  }

  for (const u of design.uncovered) {
    if (!ids.frs.includes(u.fr)) add({ kind: "unknown-id", message: `uncovered entry cites ${u.fr}, which the spec does not have`, ref: u.fr, line: u.line });
  }
  for (const f of design.flags) {
    if (!criterionExists(f.ref, ids)) add({ kind: "unknown-id", message: `flag cites ${f.ref}, which the spec does not have`, ref: f.ref, line: f.line });
  }

  // Cases per story (a case counts once for each distinct story it cites).
  const perStory = new Map<number, number>();
  for (const c of live) {
    const stories = new Set<number>();
    for (const ref of c.criteria) {
      const m = CRITERION_RE.exec(ref);
      if (m) stories.add(Number(m[1]));
    }
    for (const s of stories) perStory.set(s, (perStory.get(s) ?? 0) + 1);
  }
  for (const [story, count] of [...perStory].sort((a, b) => a[0] - b[0])) {
    if (count > MAX_CASES_PER_STORY) {
      add({ kind: "too-many-cases", message: `US-${story} has ${count} cases (max ${MAX_CASES_PER_STORY}); split the story`, ref: `US-${story}` });
    }
  }

  // Every requirement is covered by a live case or deliberately uncovered with a reason.
  const coveredFr = new Set(live.flatMap((c) => c.frs));
  const waived = new Set(design.uncovered.filter((u) => u.reason !== "").map((u) => u.fr));
  for (const fr of ids.frs) {
    if (!coveredFr.has(fr) && !waived.has(fr)) {
      add({ kind: "uncovered-fr", message: `${fr} has no case and is not marked deliberately uncovered`, ref: fr });
    }
  }

  // Every acceptance criterion has a case or a flag (SC-001).
  // A case must cite the exact `US-n#k`; a flag may also name the whole story (`US-n`).
  const caseRefs = new Set(live.flatMap((c) => c.criteria));
  const flagRefs = new Set(design.flags.map((f) => f.ref));
  for (const [story, count] of [...ids.criteria].sort((a, b) => a[0] - b[0])) {
    for (let k = 1; k <= count; k++) {
      const ref = `US-${story}#${k}`;
      if (!caseRefs.has(ref) && !flagRefs.has(ref) && !flagRefs.has(`US-${story}`)) {
        add({ kind: "uncovered-criterion", message: `${ref} has no case and no flag`, ref });
      }
    }
  }
  return findings;
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

/** Project-relative directory holding decision records (feature 022). Created on first use, never at init. */
export const DECISIONS_DIR = ".amby/decisions";
/** The index file inside `DECISIONS_DIR`, patched in place by `/amby.decide`. */
export const DECISIONS_INDEX = "README.md";

export const DECISION_STATUSES = ["proposed", "accepted", "superseded", "deprecated"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export interface DecisionRecord {
  id: string; // ADR-###
  title: string;
  status: DecisionStatus;
  date?: string;
  feature?: string;
  principle?: string;
  conflicts: string[];
  supersedes?: string;
  supersededBy?: string;
  /** File name inside `DECISIONS_DIR`, e.g. `ADR-001.md`. */
  file: string;
}

export interface DecisionIssue {
  kind:
    | "duplicate-id"
    | "dangling-citation"
    | "supersede-mismatch"
    | "supersede-cycle"
    | "accepted-with-conflict"
    | "index-drift"
    | "invalid-record";
  level: "error" | "warning";
  message: string;
  /** ADR ids involved. */
  ids: string[];
}

/** A place that cites an `ADR-###` (a project-relative path). */
export interface Citation {
  id: string;
  source: string;
}

export interface DecisionsInput {
  records: DecisionRecord[];
  /** Files in the decisions dir that could not be parsed. */
  invalid: { file: string; message: string }[];
  /** ADR ids listed in the index, or null when there is no index file. */
  indexIds: string[] | null;
  citations: Citation[];
}

const ADR_ID = /^ADR-\d{3,}$/;
const CITATION = /\bADR-\d{3,}\b/g;

// YAML leaves empty values as null; treat them as absent.
const optional = z.preprocess((v) => (v === null || v === "" ? undefined : v), z.union([z.string(), z.number()]).optional());
const optionalId = z.preprocess((v) => (v === null || v === "" ? undefined : v), z.string().regex(ADR_ID, "ADR-### id").optional());

const frontmatterSchema = z.object({
  id: z.string().regex(ADR_ID, "id must look like ADR-001"),
  title: z.string().min(1),
  status: z.enum(DECISION_STATUSES),
  date: z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), optional),
  feature: optional,
  principle: optional,
  conflicts: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.union([z.string(), z.number()])),
  ),
  supersedes: optionalId,
  "superseded-by": optionalId,
});

/** Parse one record. Throws with the file name when the frontmatter is invalid. */
export function parseDecision(raw: string, file: string): DecisionRecord {
  const parsed = matter(raw);
  const fm = frontmatterSchema.safeParse(parsed.data);
  if (!fm.success) throw new Error(`Invalid decision frontmatter in ${file}: ${fm.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const d = fm.data;
  const str = (v: string | number | undefined): string | undefined => (v === undefined ? undefined : String(v));
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    date: str(d.date),
    feature: str(d.feature),
    principle: str(d.principle),
    conflicts: d.conflicts.map(String),
    supersedes: d.supersedes,
    supersededBy: d["superseded-by"],
    file,
  };
}

/** Unique `ADR-###` citations in a text, in order of first appearance. */
export function findCitations(text: string): string[] {
  return Array.from(new Set(text.match(CITATION) ?? []));
}

/**
 * Next record number, zero-padded to three digits: the highest of the record file names and the index
 * rows, plus one. Index rows of deleted files (tombstones) still count, so a number is never reused.
 */
export function nextAdrNumber(fileNames: string[], indexText: string): string {
  let max = 0;
  const take = (id: string): void => {
    const n = Number(id.slice(4));
    if (n > max) max = n;
  };
  for (const f of fileNames) {
    const m = /^(ADR-\d{3,})\.md$/.exec(f);
    if (m) take(m[1] as string);
  }
  for (const id of findCitations(indexText)) take(id);
  return String(max + 1).padStart(3, "0");
}

/** Follow `superseded-by` to the live record (SC-003). Undefined when `id` is unknown or the chain loops. */
export function currentOf(records: DecisionRecord[], id: string): DecisionRecord | undefined {
  const byId = new Map(records.map((r) => [r.id, r]));
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur?.supersededBy) {
    if (seen.has(cur.id)) return undefined;
    seen.add(cur.id);
    cur = byId.get(cur.supersededBy);
  }
  return cur;
}

/** Pure checks over loaded decisions (feature 022). No filesystem. */
export function analyzeDecisions(input: DecisionsInput): DecisionIssue[] {
  const issues: DecisionIssue[] = [];
  const { records } = input;
  const byId = new Map<string, DecisionRecord>();

  for (const inv of input.invalid) {
    issues.push({ kind: "invalid-record", level: "error", message: `${inv.file}: ${inv.message}`, ids: [] });
  }

  // duplicate-id: two records share an id, or the id differs from the file name.
  for (const r of records) {
    const stem = r.file.replace(/\.md$/, "");
    if (stem !== r.id) {
      issues.push({ kind: "duplicate-id", level: "error", message: `${r.file} declares id ${r.id} (the file name must match the id)`, ids: [r.id] });
    }
    const prev = byId.get(r.id);
    if (prev) {
      issues.push({ kind: "duplicate-id", level: "error", message: `${r.id} is declared by both ${prev.file} and ${r.file}`, ids: [r.id] });
    } else byId.set(r.id, r);
  }

  // dangling-citation: cited but no record.
  const reported = new Set<string>();
  for (const c of input.citations) {
    const key = `${c.id}@${c.source}`;
    if (byId.has(c.id) || reported.has(key)) continue;
    reported.add(key);
    issues.push({ kind: "dangling-citation", level: "error", message: `${c.source} cites ${c.id}, which has no record`, ids: [c.id] });
  }

  // supersede-mismatch: both directions must agree.
  const mismatch = new Set<string>();
  const addMismatch = (message: string, ids: string[]): void => {
    if (mismatch.has(message)) return;
    mismatch.add(message);
    issues.push({ kind: "supersede-mismatch", level: "error", message, ids });
  };
  for (const a of records) {
    if (a.supersedes) {
      const b = byId.get(a.supersedes);
      if (b && (b.status !== "superseded" || b.supersededBy !== a.id)) {
        addMismatch(`${a.id} supersedes ${b.id}, but ${b.id} is not marked superseded with superseded-by: ${a.id}`, [a.id, b.id]);
      }
    }
    if (a.supersededBy) {
      const n = byId.get(a.supersededBy);
      if (n && n.supersedes !== a.id) addMismatch(`${a.id} says it is superseded by ${n.id}, but ${n.id} does not list supersedes: ${a.id}`, [a.id, n.id]);
      if (a.status !== "superseded") addMismatch(`${a.id} has superseded-by: ${a.supersededBy} but its status is ${a.status}`, [a.id]);
    } else if (a.status === "superseded") {
      addMismatch(`${a.id} is superseded but has no superseded-by`, [a.id]);
    }
  }

  // supersede-cycle: the chain loops.
  const cycleDone = new Set<string>();
  for (const r of records) {
    const path: string[] = [];
    let cur: DecisionRecord | undefined = r;
    while (cur && !path.includes(cur.id)) {
      path.push(cur.id);
      cur = cur.supersededBy ? byId.get(cur.supersededBy) : undefined;
    }
    if (cur) {
      const loop = path.slice(path.indexOf(cur.id));
      const key = [...loop].sort().join(",");
      if (!cycleDone.has(key)) {
        cycleDone.add(key);
        issues.push({ kind: "supersede-cycle", level: "error", message: `Supersede chain loops: ${[...loop, cur.id].join(" → ")}`, ids: loop });
      }
    }
  }

  // accepted-with-conflict.
  for (const r of records) {
    if (r.status === "accepted" && r.conflicts.length > 0) {
      issues.push({
        kind: "accepted-with-conflict",
        level: "error",
        message: `${r.id} is accepted but conflicts with principle ${r.conflicts.join(", ")} (keep it proposed until a person resolves it)`,
        ids: [r.id],
      });
    }
  }

  // index-drift: a record has no row in the index.
  if (records.length > 0) {
    const listed = new Set(input.indexIds ?? []);
    for (const r of records) {
      if (!listed.has(r.id)) {
        issues.push({ kind: "index-drift", level: "warning", message: `${r.id} has no row in ${DECISIONS_DIR}/${DECISIONS_INDEX}`, ids: [r.id] });
      }
    }
  }
  return issues;
}

function listMarkdown(dir: string, rel: string, out: { abs: string; rel: string }[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) listMarkdown(join(dir, e.name), `${rel}/${e.name}`, out);
    else if (e.name.endsWith(".md")) out.push({ abs: join(dir, e.name), rel: `${rel}/${e.name}` });
  }
}

/**
 * The one filesystem edge: read the records, the index, and every `ADR-###` citation in
 * `specs/**\/*.md`, the constitution and the records (markdown only, never code).
 */
export function loadDecisions(root: string): DecisionsInput {
  const records: DecisionRecord[] = [];
  const invalid: { file: string; message: string }[] = [];
  const citations: Citation[] = [];
  const cite = (text: string, source: string): void => {
    for (const id of findCitations(text)) citations.push({ id, source });
  };

  const dir = join(root, DECISIONS_DIR);
  let indexIds: string[] | null = null;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, f), "utf8");
      if (f === DECISIONS_INDEX) {
        indexIds = findCitations(raw);
        continue;
      }
      try {
        records.push(parseDecision(raw, f));
        cite(raw, `${DECISIONS_DIR}/${f}`);
      } catch (err) {
        invalid.push({ file: `${DECISIONS_DIR}/${f}`, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const constitution = join(root, ".amby", "constitution.md");
  if (existsSync(constitution)) cite(readFileSync(constitution, "utf8"), ".amby/constitution.md");

  const specFiles: { abs: string; rel: string }[] = [];
  listMarkdown(join(root, "specs"), "specs", specFiles);
  for (const f of specFiles) cite(readFileSync(f.abs, "utf8"), f.rel);

  return { records, invalid, indexIds, citations };
}

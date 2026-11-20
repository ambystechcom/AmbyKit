// Migrate output (030:FR-007, FR-008): a per-feature summary of what changed (lines added and removed per file), what was
// skipped and the fix each skip needs, plus the unified diff of each change for `--diff`. Strings only, no filesystem.

export type RecordStatus = "converted" | "unchanged" | "skipped";

/** One spec.md or tasks.md considered by a migrate run. */
export interface MigrateRecord {
  feature: string;
  file: "spec.md" | "tasks.md";
  status: RecordStatus;
  /** Why unchanged or skipped. */
  reason?: string;
  /** What to do about a skip. */
  fix?: string;
  /** Lines added and removed (converted files). */
  add?: number;
  del?: number;
  /** Extra facts shown beside a conversion: minimal frontmatter added, headings stripped, transitional dual-write… */
  notes?: string[];
  /** Original and converted text, kept only to render `--diff`. */
  before?: string;
  after?: string;
}

/** Lines added and removed between two texts, counted as a multiset so a moved line is neither. */
export function lineDelta(before: string, after: string): { add: number; del: number } {
  const count = (t: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (const l of t.split(/\r?\n/)) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const a = count(before);
  const b = count(after);
  let add = 0;
  let del = 0;
  for (const [l, n] of b) add += Math.max(0, n - (a.get(l) ?? 0));
  for (const [l, n] of a) del += Math.max(0, n - (b.get(l) ?? 0));
  return { add, del };
}

const MAX_CELLS = 25_000_000;

/** Lines of a text; a final newline does not make an extra empty line. */
function toLines(t: string): string[] {
  const l = t.split(/\r?\n/);
  if (l.length > 0 && l[l.length - 1] === "") l.pop();
  return l;
}

/**
 * A unified diff (3 lines of context) of two texts. Longest-common-subsequence based, deterministic. Files whose line
 * product is beyond a safe size get a one-line notice instead of a diff.
 */
export function unifiedDiff(path: string, before: string, after: string, context = 3): string {
  if (before === after) return "";
  const a = toLines(before);
  const b = toLines(after);
  if (a.length * b.length > MAX_CELLS) return `--- a/${path}\n+++ b/${path}\n(diff too large to show: ${a.length} -> ${b.length} lines)`;
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? (lcs[(i + 1) * w + j + 1] as number) + 1 : Math.max(lcs[(i + 1) * w + j] as number, lcs[i * w + j + 1] as number);
    }
  }
  type Op = { t: " " | "-" | "+"; line: string; ai: number; bi: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ t: " ", line: a[i] as string, ai: i, bi: j });
      i++;
      j++;
    } else if (i < n && (j === m || (lcs[(i + 1) * w + j] as number) >= (lcs[i * w + j + 1] as number))) {
      ops.push({ t: "-", line: a[i] as string, ai: i, bi: j });
      i++;
    } else {
      ops.push({ t: "+", line: b[j] as string, ai: i, bi: j });
      j++;
    }
  }
  const changeAt = ops.map((o, k) => (o.t === " " ? -1 : k)).filter((k) => k !== -1);
  if (changeAt.length === 0) return "";
  // merge change positions into hunks with `context` lines on each side
  const hunks: [number, number][] = [];
  for (const k of changeAt) {
    const from = Math.max(0, k - context);
    const to = Math.min(ops.length - 1, k + context);
    const last = hunks[hunks.length - 1];
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else hunks.push([from, to]);
  }
  const out = [`--- a/${path}`, `+++ b/${path}`];
  for (const [from, to] of hunks) {
    const slice = ops.slice(from, to + 1);
    const first = slice[0] as Op;
    const aStart = first.ai + 1;
    const bStart = first.bi + 1;
    const aLen = slice.filter((o) => o.t !== "+").length;
    const bLen = slice.filter((o) => o.t !== "-").length;
    out.push(`@@ -${aLen === 0 ? first.ai : aStart},${aLen} +${bLen === 0 ? first.bi : bStart},${bLen} @@`);
    for (const o of slice) out.push(`${o.t}${o.line}`);
  }
  return out.join("\n");
}

export interface SummaryOptions {
  dryRun?: boolean;
  /** Append each converted file's unified diff. */
  diff?: boolean;
}

const pad = (s: string, n: number): string => s + " ".repeat(Math.max(0, n - s.length));

/** The per-feature summary and totals. Deterministic: features and files in the order given. */
export function summarize(records: MigrateRecord[], opts: SummaryOptions = {}): string {
  const out: string[] = [];
  out.push(opts.dryRun ? "Dry run: nothing was written. This is what migrate would do." : "Migrated.");
  const byFeature = new Map<string, MigrateRecord[]>();
  for (const r of records) byFeature.set(r.feature, [...(byFeature.get(r.feature) ?? []), r]);
  for (const [feature, recs] of byFeature) {
    const converted = recs.filter((r) => r.status === "converted");
    const add = converted.reduce((s, r) => s + (r.add ?? 0), 0);
    const del = converted.reduce((s, r) => s + (r.del ?? 0), 0);
    out.push("", `${feature}${converted.length > 0 ? `  (+${add} -${del})` : ""}`);
    for (const r of recs) {
      const label = pad(r.file, 9);
      if (r.status === "converted") {
        const notes = r.notes && r.notes.length > 0 ? `  (${r.notes.join("; ")})` : "";
        out.push(`  ${label}${opts.dryRun ? "would convert" : "converted"}  +${r.add ?? 0} -${r.del ?? 0}${notes}`);
      } else if (r.status === "unchanged") {
        out.push(`  ${label}unchanged${r.reason ? `  (${r.reason})` : ""}`);
      } else {
        out.push(`  ${label}SKIPPED  untouched: ${r.reason ?? "not safe to convert"}`);
        if (r.fix) out.push(`  ${" ".repeat(9)}fix: ${r.fix}`);
      }
    }
  }
  const by = (s: RecordStatus): MigrateRecord[] => records.filter((r) => r.status === s);
  const total = by("converted");
  const add = total.reduce((s, r) => s + (r.add ?? 0), 0);
  const del = total.reduce((s, r) => s + (r.del ?? 0), 0);
  out.push(
    "",
    `Total: ${total.length} ${opts.dryRun ? "to convert" : "converted"}, ${by("unchanged").length} unchanged, ${by("skipped").length} skipped (left untouched) — +${add} -${del} lines`,
  );
  if (opts.diff) {
    for (const r of total) {
      if (r.before === undefined || r.after === undefined) continue;
      const d = unifiedDiff(`specs/${r.feature}/${r.file}`, r.before, r.after);
      if (d) out.push("", d);
    }
  }
  return out.join("\n");
}

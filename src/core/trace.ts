import { parseCitation } from "./trace-cite.js";
import type {
  AmbiguousTest,
  CoverageCounts,
  DesignCaseRow,
  DesignInput,
  FeatureTrace,
  OrphanTest,
  RequirementRow,
  SkippedTest,
  TestEntry,
  TraceFeature,
  TraceReport,
  UncitedTest,
} from "./trace-types.js";

export interface MatrixInput {
  features: TraceFeature[];
  tests: TestEntry[];
  /** Designed cases per feature dir (spec 021); absent ⇒ requirement-only report (FR-018). */
  designs?: Map<string, DesignInput>;
  /** Report only this feature (dir or ref); orphans/ambiguous are then limited to ones that concern it. */
  only?: string;
}

export function emptyCounts(): CoverageCounts {
  return { covered: 0, total: 0, uncovered: 0, deliberate: 0 };
}

/**
 * Build the requirement × test matrix (feature 024, FR-001…FR-007, FR-017). Pure: callers read files.
 * A test cites only through a qualified-ID prefix; a skipped/todo test never covers (it is listed in
 * `skipped`); a bare `FR-###` never matches and is ambiguous (several features define it) or unqualified.
 */
export function buildMatrix(input: MatrixInput): TraceReport {
  const { features, tests } = input;
  const byRef = new Map<string, TraceFeature[]>();
  const definers = new Map<string, string[]>(); // bare FR id → feature refs defining it
  for (const f of features) {
    byRef.set(f.ref, [...(byRef.get(f.ref) ?? []), f]);
    for (const r of f.requirements) definers.set(r.id, [...(definers.get(r.id) ?? []), f.ref]);
  }

  const covering = new Map<string, TestEntry[]>(); // `dir:FR-###` → live citing tests
  const orphans: OrphanTest[] = [];
  const uncited: UncitedTest[] = [];
  const ambiguous: AmbiguousTest[] = [];
  const skipped: SkippedTest[] = [];

  for (const t of tests) {
    const cite = parseCitation(t.title);
    if (cite.qualified.length === 0 && cite.bare.length === 0) {
      uncited.push({ ...t, reason: "no-id" });
      continue;
    }
    const unknown: string[] = [];
    const known: { f: TraceFeature; id: string }[] = [];
    for (const q of cite.qualified) {
      const targets = (byRef.get(q.ref) ?? []).filter((f) => f.requirements.some((r) => r.id === q.id));
      if (targets.length === 0) unknown.push(q.qid);
      for (const f of targets) known.push({ f, id: q.id });
    }
    for (const id of cite.bare) {
      const refs = definers.get(id) ?? [];
      if (refs.length > 1) ambiguous.push({ ...t, id, features: [...new Set(refs)].sort() });
      else uncited.push({ ...t, reason: "unqualified" });
    }
    if (unknown.length > 0) orphans.push({ ...t, cites: unknown });
    if (t.skipped) {
      if (known.length > 0 || unknown.length > 0) skipped.push({ ...t, cites: [...new Set([...known.map((k) => `${k.f.ref}:${k.id}`), ...unknown])] });
      continue;
    }
    for (const k of known) {
      const key = `${k.f.dir}:${k.id}`;
      const list = covering.get(key) ?? [];
      if (!list.includes(t)) list.push(t);
      covering.set(key, list);
    }
  }

  const wanted = (f: TraceFeature): boolean => !input.only || f.dir === input.only || f.ref === input.only;
  const traces: FeatureTrace[] = [];
  for (const f of features.filter(wanted)) {
    const rows: RequirementRow[] = f.requirements.map((r) => {
      const tests = covering.get(`${f.dir}:${r.id}`) ?? [];
      const reason = f.deliberate.get(r.id);
      const status = tests.length > 0 ? "covered" : reason !== undefined ? "deliberate" : "uncovered";
      return { id: r.id, qid: `${f.ref}:${r.id}`, text: r.text, status, ...(status === "deliberate" ? { reason } : {}), tests };
    });
    const coverage = emptyCounts();
    for (const r of rows) {
      coverage.total++;
      if (r.status === "covered") coverage.covered++;
      else if (r.status === "deliberate") coverage.deliberate++;
      else coverage.uncovered++;
    }
    const trace: FeatureTrace = { feature: f.dir, ref: f.ref, hasRequirements: rows.length > 0, requirements: rows, coverage };
    const design = input.designs?.get(f.dir);
    if (design && design.cases.length > 0) {
      const cases: DesignCaseRow[] = design.cases.map((c) => ({
        id: c.id,
        fr: c.fr,
        kind: c.kind,
        state: c.kind === "manual" ? "manual" : c.fr.some((id) => (covering.get(`${f.dir}:${id}`) ?? []).length > 0) ? "matched" : "missing",
      }));
      trace.design = { cases };
    }
    traces.push(trace);
  }

  if (!input.only) return { version: 1, features: traces, orphans, uncited, ambiguous, skipped };
  const refs = new Set(traces.map((t) => t.ref));
  return {
    version: 1,
    features: traces,
    orphans: orphans.filter((o) => o.cites.some((c) => refs.has(c.split(":")[0]!))),
    uncited: [],
    ambiguous: ambiguous.filter((a) => a.features.some((r) => refs.has(r))),
    skipped: skipped.filter((s) => s.cites.some((c) => refs.has(c.split(":")[0]!))),
  };
}

/** Requirements the gate counts: uncovered and not deliberate (FR-009, FR-010). */
export function uncoveredCount(report: TraceReport): number {
  return report.features.reduce((n, f) => n + f.coverage.uncovered, 0);
}

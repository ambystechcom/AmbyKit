import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { buildMatrix, uncoveredCount } from "../core/trace.js";
import { readTraceSources } from "../core/trace-io.js";
import type { FeatureTrace, TestEntry, TraceReport } from "../core/trace-types.js";
import { findProjectRoot } from "../core/paths.js";

/** Uncited tests listed in text output before the rest is summarized (the full list is in `--json`). */
const UNCITED_LIST_CAP = 20;

/**
 * `ambykit trace [feature] [--json] [--gate]` — which requirements have tests (feature 024). Zero model
 * tokens and read-only: it never edits a spec or a test (FR-011). `--gate` only changes the exit code.
 */
export class TraceCommand extends BaseCommand {
  readonly name = "trace";
  readonly summary = "Show which requirements are covered by tests (tests cite NNN:FR-### in their names).";
  readonly usage = "ambykit trace [feature] [--json] [--gate]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = findProjectRoot(opts.cwd) ?? opts.cwd;
    const src = readTraceSources(root);
    const arg = opts.positionals[0];
    let only: string | undefined;
    if (arg) {
      const hit = src.features.find((f) => f.dir === arg) ?? src.features.find((f) => f.ref === arg);
      if (!hit) {
        this.error(`Feature '${arg}' not found.`, "Use a feature number or directory name from specs/.");
        return 1;
      }
      only = hit.dir;
    }
    const report = buildMatrix({ features: src.features, tests: src.tests, designs: src.designs, ...(only ? { only } : {}) });

    if (flag(opts, "json")) console.log(JSON.stringify(report, null, 2));
    else for (const line of renderTrace(report, only !== undefined)) console.log(line);

    return flag(opts, "gate") && uncoveredCount(report) > 0 ? 1 : 0;
  }
}

const where = (t: TestEntry): string => `${t.file}:${t.line}`;

/** Plain-text report: no color or glyph dependency (FR-014). */
export function renderTrace(report: TraceReport, single: boolean): string[] {
  const out: string[] = [];
  for (const f of report.features) out.push(...renderFeature(f));
  if (report.orphans.length > 0) {
    out.push("", `Orphans (${report.orphans.length}) — cite an id that exists in no spec:`);
    for (const o of report.orphans) out.push(`  ${where(o)}  ${o.cites.join(", ")}  ${o.title}`);
  }
  if (report.ambiguous.length > 0) {
    out.push("", `Ambiguous (${report.ambiguous.length}) — bare id defined by several features; use NNN:FR-###:`);
    for (const a of report.ambiguous) out.push(`  ${where(a)}  ${a.id} in ${a.features.join(", ")}`);
  }
  if (report.skipped.length > 0) {
    out.push("", `Skipped (${report.skipped.length}) — cite an id but do not count as covering:`);
    for (const s of report.skipped) out.push(`  ${where(s)}  ${s.cites.join(", ")}  ${s.title}`);
  }
  if (!single && report.uncited.length > 0) {
    const unq = report.uncited.filter((u) => u.reason === "unqualified").length;
    out.push("", `Uncited tests: ${report.uncited.length} (no qualified id in the name${unq ? `; ${unq} use a bare FR-### — write NNN:FR-###` : ""})`);
    for (const u of report.uncited.slice(0, UNCITED_LIST_CAP)) out.push(`  ${where(u)}  ${u.title}`);
    if (report.uncited.length > UNCITED_LIST_CAP) out.push(`  … and ${report.uncited.length - UNCITED_LIST_CAP} more (see --json)`);
  }
  return out;
}

function renderFeature(f: FeatureTrace): string[] {
  if (!f.hasRequirements) return [`${f.feature}: no requirements`];
  const c = f.coverage;
  const extra = [c.uncovered ? `${c.uncovered} uncovered` : "", c.deliberate ? `${c.deliberate} deliberate` : ""].filter(Boolean);
  const out = [`${f.feature}: ${c.covered}/${c.total} covered${extra.length ? ` (${extra.join(", ")})` : ""}`];
  for (const r of f.requirements) {
    if (r.status === "uncovered") out.push(`  uncovered  ${r.id}  ${r.text}`);
    else if (r.status === "deliberate") out.push(`  deliberate ${r.id}  ${r.reason ?? ""}`);
    else out.push(`  covered    ${r.id}  ${r.tests.map(where).join(", ")}`);
  }
  if (f.design) {
    out.push("  designed cases:");
    for (const d of f.design.cases) out.push(`    ${d.state.padEnd(7)} ${d.id}  ${d.fr.join(", ")}`);
  }
  return out;
}

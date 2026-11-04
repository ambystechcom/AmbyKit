import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { analyzeProject } from "../core/analyze.js";
import { describeConflict } from "../core/lanes.js";

/**
 * Machine-checkable consistency analysis of the story dependency graph — cycles, dangling
 * references, blocked vs buildable, orphans. Runs locally with zero model tokens (complements the
 * generative `/amby.analyze` phase). Exits non-zero on structural issues so CI can gate on it.
 */
export class AnalyzeCommand extends BaseCommand {
  readonly name = "analyze";
  readonly summary = "Validate the story dependency graph and parallel-lane file ownership.";
  readonly usage = "ambykit analyze [--json]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const report = analyzeProject(root);

    if (flag(opts, "json")) {
      this.info(JSON.stringify(report, null, 2));
      return report.issues.length > 0 || report.lanes.conflicts.length > 0 ? 1 : 0;
    }

    const conflicts = report.lanes.conflicts;
    if (report.total === 0 && conflicts.length === 0) {
      this.info("No user stories found.");
      return 0;
    }

    this.info(`Analyzed ${report.total} stories across the dependency graph.\n`);

    if (report.issues.length > 0) {
      this.error("Structural issues:");
      for (const issue of report.issues) this.info(`  [${issue.kind}] ${issue.message}`);
      this.info("");
    }

    if (conflicts.length > 0) {
      this.error("Lane conflicts:");
      for (const c of conflicts) this.info(`  ${describeConflict(c)}`);
      this.info("");
    }

    if (report.blocked.length > 0) {
      this.info("Blocked (waiting on unfinished dependencies):");
      for (const b of report.blocked) this.info(`  ${b.displayId} — blocked by ${b.on.join(", ")}`);
      this.info("");
    }

    this.info(
      report.buildable.length > 0
        ? `Buildable now: ${report.buildable.join(", ")}`
        : "Buildable now: (none)",
    );
    if (report.orphans.length > 0) {
      this.warn(`Stories with no tasks: ${report.orphans.join(", ")}`);
    }

    const decl = report.lanes.declarations;
    if (decl.length > 0) {
      const label = (d: (typeof decl)[number]): string => `${d.feature}:${d.task} (${d.issue === "glob" ? "glob" : "no path"})`;
      this.warn(`Tasks without a usable file path: ${decl.map(label).join(", ")}`);
    }

    if (report.issues.length > 0 || conflicts.length > 0) return 1;
    this.success("No cycles, dangling references, or lane conflicts.");
    return 0;
  }
}

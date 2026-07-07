import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./fsops.js";
import { buildEmittedFiles } from "./emit.js";
import { loadConfig, saveConfig } from "../core/config.js";
import { getTarget, TARGETS } from "../emitters/index.js";

export class AddCommand extends BaseCommand {
  readonly name = "add";
  readonly summary = "Add or refresh integration for one or more targets.";
  readonly usage = "ambykit add <tool...> [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    if (opts.positionals.length === 0) {
      this.error("Specify at least one target.");
      this.info(`Available: ${TARGETS.map((t) => t.id).join(", ")}`);
      return 1;
    }
    const unknown = opts.positionals.filter((t) => !getTarget(t));
    if (unknown.length > 0) {
      this.error(`Unknown target(s): ${unknown.join(", ")}`);
      this.info(`Available: ${TARGETS.map((t) => t.id).join(", ")}`);
      return 1;
    }

    const config = loadConfig(root);
    const merged = Array.from(new Set([...config.tools, ...opts.positionals]));
    config.tools = merged;
    if (!this.dryRun) saveConfig(root, config);

    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, { dryRun: this.dryRun, includeUser: false });
    const changed = this.dryRun ? result.wouldChange : result.written;
    this.success(`${this.dryRun ? "Would add" : "Added"}: ${opts.positionals.join(", ")}`);
    this.info(`${this.dryRun ? "Would emit" : "Emitted"} ${changed.length} file(s); ${result.unchanged.length} unchanged.`);
    for (const p of changed) this.debug(p);
    return 0;
  }
}

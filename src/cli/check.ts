import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./fsops.js";
import { buildEmittedFiles } from "./emit.js";
import { loadConfig } from "../core/config.js";
import { getTarget } from "../emitters/index.js";

export class CheckCommand extends BaseCommand {
  readonly name = "check";
  readonly summary = "Verify the AmbyKit setup and report drift from the neutral source.";
  readonly usage = "ambykit check";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    let ok = true;

    if (!existsSync(join(root, ".amby", "constitution.md"))) {
      this.warn("Missing .amby/constitution.md — run /amby.constitution.");
      ok = false;
    }

    const config = loadConfig(root);
    if (config.tools.length === 0) {
      this.warn("No tools configured.");
      ok = false;
    }
    for (const t of config.tools) {
      if (!getTarget(t)) {
        this.warn(`Configured tool '${t}' is not a known target.`);
        ok = false;
      }
    }

    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, { dryRun: true, includeUser: false });
    if (result.wouldChange.length > 0) {
      this.warn(`${result.wouldChange.length} generated file(s) are out of sync — run \`ambykit sync\`.`);
      for (const p of result.wouldChange) this.info(`  ~ ${p}`);
      ok = false;
    }

    if (ok) {
      this.success(`Healthy: ${config.tools.join(", ")} · ${result.unchanged.length} file(s) in sync.`);
      return 0;
    }
    return 1;
  }
}

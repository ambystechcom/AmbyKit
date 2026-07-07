import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./fsops.js";
import { buildEmittedFiles } from "./emit.js";
import { loadConfig } from "../core/config.js";

export class UpgradeCommand extends BaseCommand {
  readonly name = "upgrade";
  readonly summary = "Update AmbyKit and re-sync generated files.";
  readonly usage = "ambykit upgrade [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    // Package-manager self-update is out of scope for M1; upgrade currently re-syncs from the
    // installed version. Update the package with your package manager (e.g. `npm i -g
    // @ambystech/ambykit@latest`) then run this to refresh generated files.
    const root = this.projectRoot(opts.cwd);
    const config = loadConfig(root);
    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, { dryRun: this.dryRun, includeUser: false });
    const changed = this.dryRun ? result.wouldChange : result.written;
    this.success(`${this.dryRun ? "Would refresh" : "Refreshed"} ${changed.length} file(s); ${result.unchanged.length} unchanged.`);
    this.info("To update the AmbyKit version itself, run `npm i -g @ambystech/ambykit@latest`.");
    return 0;
  }
}

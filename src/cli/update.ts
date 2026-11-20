import { spawnSync } from "node:child_process";
import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./io/fsops.js";
import { buildEmittedFiles } from "../core/emit.js";
import { loadConfig } from "../core/config.js";
import { isOutdated } from "../core/version.js";
import { packageVersion, projectAtCwd } from "../core/paths.js";
import { refreshLatest } from "./io/version-check.js";
import { loadPluginSession } from "../plugins/session.js";
import { reportPlugins } from "../plugins/report.js";
import { movedTargetNotices } from "../core/moved-targets.js";
import { getTarget } from "../emitters/index.js";

const PACKAGE = "@ambystech/ambykit";

/**
 * `ambykit update` (feature 010). Updates the CLI when it is behind the latest published version and —
 * on a re-run once current — refreshes the project's tool prompts (US-3). The CLI self-update and the
 * latest-version lookup are `protected` seams so tests can drive them without spawning npm or hitting
 * the network.
 */
export class UpdateCommand extends BaseCommand {
  readonly name = "update";
  readonly summary = "Update the AmbyKit CLI, then refresh this project's tool prompts.";
  readonly usage = "ambykit update";
  protected override requiresProject = false;

  protected async execute(opts: CliOptions): Promise<number> {
    const installed = packageVersion();
    const latest = await this.latestVersion();

    if (latest !== null && isOutdated(installed, latest)) {
      return this.updateCli(installed, latest);
    }
    // CLI is current (or latest unknown) → refresh the project's prompts (US-3) and report (US-4).
    return await this.refreshProject(opts, installed);
  }

  /** Attempt a global install of the latest; on success, stop and ask the user to re-run (R-5). */
  private updateCli(installed: string, latest: string): number {
    this.info(`AmbyKit ${installed} → ${latest}: updating the CLI…`);
    if (this.installCli()) {
      this.success(`Updated AmbyKit to ${latest}.`);
      this.info("Re-run `ambykit update` to refresh this project's prompts with the new version.");
      return 0;
    }
    // Ephemeral npx run or a permissions error (EACCES): leave the install intact, print the command.
    this.error(
      "Could not update the CLI automatically.",
      `Run: npm install -g ${PACKAGE}@latest`,
    );
    return 1;
  }

  /**
   * The CLI is current: refresh the project's emitted prompts if we're in an AmbyKit project at the
   * invocation dir (`.amby/` AND `specs/`), reusing the `sync` pipeline (US-3, Principle 1/2). Skips
   * cleanly outside a project (FR-010). Reports the outcome, incl. the exact up-to-date message (US-4).
   */
  protected async refreshProject(opts: CliOptions, installed: string): Promise<number> {
    const root = opts.cwd;
    if (!projectAtCwd(root)) {
      this.info(`AmbyKit ${installed} is current. Not in an AmbyKit project — no prompts to refresh.`);
      return 0;
    }
    const config = loadConfig(root);
    const session = await loadPluginSession(root, config); // plugin targets refresh with the rest (feature 027)
    for (const line of reportPlugins(session).errors) this.warn(line);
    // A moved target whose plugin is not installed fails that target only (feature 036, FR-004/FR-005): the others
    // refresh, nothing is deleted, and the run exits 1 after saying which package to install.
    const movedMissing = movedTargetNotices(config.tools, (id) => getTarget(id, session?.registry) !== undefined);
    for (const notice of movedMissing) this.error(notice);
    const failed = movedMissing.length > 0 ? 1 : 0;
    const files = buildEmittedFiles(root, config, session?.registry);
    const result = applyFiles(root, files, { dryRun: this.dryRun, includeUser: false });
    const changed = this.dryRun ? result.wouldChange.length : result.written.length;
    if (changed === 0) {
      this.success("Everything is up to date.");
      return failed;
    }
    this.success(`${this.dryRun ? "Would refresh" : "Refreshed"} ${changed} prompt file(s).`);
    this.printSummary(result);
    return failed;
  }

  /** The latest published version (awaited, since the user explicitly asked). Overridable in tests. */
  protected async latestVersion(): Promise<string | null> {
    return refreshLatest(3000);
  }

  /** Run the global install; return whether it succeeded. Overridable in tests. */
  protected installCli(): boolean {
    const res = spawnSync("npm", ["install", "-g", `${PACKAGE}@latest`], {
      stdio: "inherit",
      shell: true,
    });
    return res.status === 0;
  }
}

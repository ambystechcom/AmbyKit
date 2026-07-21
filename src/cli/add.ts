import { BaseCommand, type CliOptions } from "./base-command.js";
import { applyFiles } from "./io/fsops.js";
import { buildEmittedFiles } from "../core/emit.js";
import { loadConfig, saveConfig } from "../core/config.js";
import { getTarget, TARGETS } from "../emitters/index.js";
import { multiSelect } from "./ui/interactive/prompt.js";
import { toolOptions } from "./ui/tool-options.js";

export class AddCommand extends BaseCommand {
  readonly name = "add";
  readonly summary = "Add or refresh integration for one or more targets.";
  readonly usage = "ambykit add <tool...> [--dry-run]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const available = `Available: ${TARGETS.map((t) => t.id).join(", ")}`;
    let targets = opts.positionals;
    if (targets.length === 0) {
      if (!this.caps.isTTY) {
        // Non-TTY + no target → error with guidance instead of blocking on a prompt (US-7, FR-016).
        this.error("Specify at least one target.", available);
        return 1;
      }
      const picked = await multiSelect(this.caps, {
        message: "Select tools to add",
        options: toolOptions(),
      });
      if (picked === null || picked.length === 0) {
        this.warn("Nothing selected.");
        return 1;
      }
      targets = picked;
    }
    const unknown = targets.filter((t) => !getTarget(t));
    if (unknown.length > 0) {
      this.error(`Unknown target(s): ${unknown.join(", ")}`, available);
      return 1;
    }

    const config = loadConfig(root);
    const merged = Array.from(new Set([...config.tools, ...targets]));
    config.tools = merged;
    if (!this.dryRun) saveConfig(root, config);

    const spin = this.spinner();
    spin.start(this.dryRun ? "Checking what would change…" : "Emitting tool files…");
    const files = buildEmittedFiles(root, config);
    const result = applyFiles(root, files, { dryRun: this.dryRun, includeUser: false });
    spin.stop();

    this.success(`${this.dryRun ? "Would add" : "Added"}: ${targets.join(", ")}`);
    this.printSummary(result);
    return 0;
  }
}

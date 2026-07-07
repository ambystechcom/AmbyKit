import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { applyFiles, writeIfAbsent } from "./fsops.js";
import { buildEmittedFiles } from "./emit.js";
import { saveConfig } from "../core/config.js";
import { templatesDir } from "../core/paths.js";
import { getTarget, TARGETS } from "../emitters/index.js";
import type { AmbyConfig } from "../core/types.js";

const PKG_VERSION = "0.0.0";

/** Detect likely targets from existing tool directories; fall back to Claude Code. */
function detectTools(projectRoot: string): string[] {
  const found: string[] = [];
  if (existsSync(join(projectRoot, ".claude"))) found.push("claude");
  return found.length > 0 ? found : ["claude"];
}

export class InitCommand extends BaseCommand {
  readonly name = "init";
  readonly summary = "Scaffold AmbyKit into a project and emit tool files.";
  readonly usage = "ambykit init [dir] [--tools=claude,...] [--yes] [--dry-run]";
  protected override requiresProject = false;

  protected async execute(opts: CliOptions): Promise<number> {
    const target = resolve(opts.cwd, opts.positionals[0] ?? ".");

    const toolsFlag = stringFlag(opts, "tools");
    const tools = toolsFlag
      ? toolsFlag.split(",").map((t) => t.trim()).filter(Boolean)
      : detectTools(target);

    const unknown = tools.filter((t) => !getTarget(t));
    if (unknown.length > 0) {
      this.error(`Unknown target(s): ${unknown.join(", ")}`);
      this.info(`Available: ${TARGETS.map((t) => t.id).join(", ")}`);
      return 1;
    }

    const config: AmbyConfig = { version: PKG_VERSION, tools };

    // Scaffold .amby/ (constitution + config) unless present.
    const constitution = readFileSync(join(templatesDir(), "constitution.md"), "utf8")
      .replaceAll("{{PROJECT_NAME}}", basename(target))
      .replaceAll("{{VERSION}}", "1.0.0")
      .replaceAll("{{DATE}}", new Date().toISOString().slice(0, 10));

    if (!this.dryRun) {
      writeIfAbsent(target, join(".amby", "constitution.md"), constitution);
      saveConfig(target, config);
    }

    const files = buildEmittedFiles(target, config);
    const result = applyFiles(target, files, { dryRun: this.dryRun, includeUser: false });

    const verb = this.dryRun ? "Would emit" : "Emitted";
    const changed = this.dryRun ? result.wouldChange.length : result.written.length;
    this.success(`${this.dryRun ? "Planned" : "Initialized"} AmbyKit in ${basename(target)} for: ${tools.join(", ")}`);
    this.info(`${verb} ${changed} file(s); ${result.unchanged.length} unchanged.`);
    for (const p of this.dryRun ? result.wouldChange : result.written) this.debug(p);
    if (!this.dryRun) {
      this.info("Next: run /amby.constitution then /amby.specify in your assistant.");
    }
    return 0;
  }
}

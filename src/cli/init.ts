import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { BaseCommand, stringFlag, type CliOptions } from "./base-command.js";
import { applyFiles, writeIfAbsent } from "./io/fsops.js";
import { buildEmittedFiles } from "../core/emit.js";
import { classifyProject, describeSignals } from "../core/classify.js";
import { saveConfig } from "../core/config.js";
import { packageVersion, templatesDir } from "../core/paths.js";
import { installArtifactTemplates } from "../core/scaffold.js";
import { getTarget, TARGETS } from "../emitters/index.js";
import { banner } from "./ui/banner.js";
import { multiSelect } from "./ui/interactive/prompt.js";
import { toolOptions } from "./ui/tool-options.js";
import type { AmbyConfig } from "../core/types.js";

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

  /** Banner prints before the version warning, via the shared run() preamble hook (feature 010). */
  protected override preamble(): string | null {
    return banner();
  }

  protected async execute(opts: CliOptions): Promise<number> {
    const target = resolve(opts.cwd, opts.positionals[0] ?? ".");

    // Detect and report brownfield vs greenfield (US-3). The write path is non-destructive either
    // way, so this is informational; on an existing project it reassures that docs are preserved.
    const { mode, signals } = classifyProject(target);
    if (mode === "brownfield") {
      this.info(`Detected an existing (brownfield) project — ${describeSignals(signals)}.`);
      this.info("Existing agent docs will be preserved; AmbyKit updates only its own section.");
    } else {
      this.debug("Detected a greenfield project.");
    }

    const toolsFlag = stringFlag(opts, "tools");
    let tools: string[];
    if (toolsFlag) {
      tools = toolsFlag.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (this.caps.isTTY && !this.assumeYes) {
      // No --tools on an interactive terminal → prompt, preselecting detected tools (US-7, FR-015).
      const picked = await multiSelect(this.caps, {
        message: "Select tools to configure",
        options: toolOptions(),
        preselected: detectTools(target),
      });
      if (picked === null) {
        this.warn("Cancelled.");
        return 1;
      }
      tools = picked.length > 0 ? picked : detectTools(target);
    } else {
      // Non-TTY (or --yes): fall back to detection rather than blocking on a prompt (FR-016).
      tools = detectTools(target);
    }

    const unknown = tools.filter((t) => !getTarget(t));
    if (unknown.length > 0) {
      this.error(
        `Unknown target(s): ${unknown.join(", ")}`,
        `Available: ${TARGETS.map((t) => t.id).join(", ")}`,
      );
      return 1;
    }

    const config: AmbyConfig = { version: packageVersion(), tools };

    // Scaffold .amby/ (constitution + config) unless present.
    const constitution = readFileSync(join(templatesDir(), "constitution.md"), "utf8")
      .replaceAll("{{PROJECT_NAME}}", basename(target))
      .replaceAll("{{VERSION}}", "1.0.0")
      .replaceAll("{{DATE}}", new Date().toISOString().slice(0, 10));

    if (!this.dryRun) {
      writeIfAbsent(target, join(".amby", "constitution.md"), constitution);
      saveConfig(target, config);
    }

    // Install artifact templates + reference docs into .amby/ (write-if-absent; project owns them).
    const templates = installArtifactTemplates(target, this.dryRun);
    if (templates.created.length > 0) {
      this.debug(`${this.dryRun ? "Would install" : "Installed"} ${templates.created.length} template/reference file(s).`);
    }

    const spin = this.spinner();
    spin.start(this.dryRun ? "Checking what would change…" : "Emitting tool files…");
    const files = buildEmittedFiles(target, config);
    const result = applyFiles(target, files, { dryRun: this.dryRun, includeUser: false });
    spin.stop();

    this.success(`${this.dryRun ? "Planned" : "Initialized"} AmbyKit in ${basename(target)} for: ${tools.join(", ")}`);
    this.printSummary(result);
    if (!this.dryRun) {
      this.info("Next: run /amby.constitution then /amby.specify in your assistant.");
    }
    return 0;
  }
}

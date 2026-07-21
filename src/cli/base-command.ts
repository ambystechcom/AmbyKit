import { findProjectRoot } from "../core/paths.js";
import { detectCapabilities } from "./ui/capabilities.js";
import { outdatedWarning } from "./ui/callout.js";
import * as render from "./ui/render.js";
import { spinner, summarize, type Spinner } from "./ui/progress.js";
import { toChangeSummary, type WriteResult } from "./fsops.js";
import type { Capabilities } from "./ui/types.js";

/** Parsed CLI invocation for one command. */
export interface CliOptions {
  cwd: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Abstract base for every CLI verb. Holds shared plumbing — flag handling, project discovery,
 * logging, error/exit handling — so each command only implements `execute`. Mirrors the
 * `BaseEmitter` pattern on the emitter side.
 */
export abstract class BaseCommand {
  abstract readonly name: string;
  abstract readonly summary: string;
  abstract readonly usage: string;

  /** Commands that must run inside an AmbyKit project set this true. */
  protected requiresProject = true;

  protected verbose = false;
  protected dryRun = false;
  protected assumeYes = false;

  /** Terminal capabilities driving all styled output. Detected once from the real stdout. */
  protected caps: Capabilities = detectCapabilities();

  async run(opts: CliOptions): Promise<number> {
    this.verbose = flag(opts, "verbose");
    this.dryRun = flag(opts, "dry-run");
    this.assumeYes = flag(opts, "yes") || flag(opts, "y");

    const pre = this.preamble();
    if (pre) console.log(pre);
    await this.printVersionWarning(flag(opts, "json"));

    if (this.requiresProject && findProjectRoot(opts.cwd) === null) {
      this.error("Not inside an AmbyKit project (no .amby/ found).", "Run `ambykit init` first.");
      return 1;
    }
    try {
      return await this.execute(opts);
    } catch (err) {
      this.error(err instanceof Error ? err.message : String(err));
      if (this.verbose && err instanceof Error && err.stack) console.error(err.stack);
      return 1;
    }
  }

  protected abstract execute(opts: CliOptions): Promise<number>;

  /** Text printed before the version warning (e.g. init's banner). Default: none. */
  protected preamble(): string | null {
    return null;
  }

  /**
   * Show the outdated-version callout between the preamble and the command output (feature 010, US-1).
   * Suppressed on non-TTY and `--json` (FR-004). The hot path reads only the cache; a stale cache
   * triggers one bounded, best-effort refresh used this run (FR-005/005a) — never blocks on failure.
   */
  private async printVersionWarning(json: boolean): Promise<void> {
    if (!this.caps.isTTY || json) return;
    const warning = await outdatedWarning(this.caps);
    if (warning) console.log(warning);
  }

  /** The project root, throwing a clear error if absent. */
  protected projectRoot(cwd: string): string {
    const root = findProjectRoot(cwd);
    if (!root) throw new Error("No AmbyKit project found (missing .amby/).");
    return root;
  }

  // --- logging (all styling routes through src/cli/ui/render.ts — Principle 2) ---
  protected info(msg: string): void {
    console.log(render.info(msg));
  }
  protected heading(msg: string): void {
    console.log(render.heading(this.caps, msg));
  }
  protected success(msg: string): void {
    console.log(render.success(this.caps, msg));
  }
  protected warn(msg: string): void {
    console.warn(render.warn(this.caps, msg));
  }
  /** Error line, optionally with an actionable next-step hint (`→ …`). */
  protected error(msg: string, next?: string): void {
    console.error(render.error(this.caps, msg, next));
  }
  protected debug(msg: string): void {
    if (this.verbose) console.log(render.info(`  ${msg}`));
  }

  /** A spinner for live feedback during multi-step work (no-op on a non-TTY). */
  protected spinner(): Spinner {
    return spinner(this.caps);
  }

  /** Print the created/updated/unchanged/skipped block for a write result (US-3). */
  protected printSummary(result: WriteResult): void {
    const block = summarize(this.caps, toChangeSummary(result, this.dryRun));
    if (block) console.log(block);
    this.printRegionOutcomes(result);
  }

  /**
   * Report the brownfield-merge outcomes that the generic summary does not cover (feature 008):
   * pre-modification backups, hand-edited regions left untouched, and files that could not be
   * merged safely. Silent when none apply.
   */
  protected printRegionOutcomes(result: WriteResult): void {
    if (result.backedUp.length > 0) {
      this.info(`  backed up ${result.backedUp.length} file(s) before updating → .amby/backups/`);
    }
    if (result.skippedRegions.length > 0) {
      this.warn(`Left ${result.skippedRegions.length} hand-edited AmbyKit region(s) untouched:`);
      for (const p of result.skippedRegions) this.info(`  ~ ${p}`);
      this.info("  Revert your edits (or remove the region) and re-run to let AmbyKit refresh it.");
    }
    if (result.aborted.length > 0) {
      this.warn(`Could not safely update ${result.aborted.length} file(s):`);
      for (const p of result.aborted) this.info(`  ! ${p}`);
    }
  }
}

/** Read a boolean flag (present-as-true) from options. */
export function flag(opts: CliOptions, name: string): boolean {
  const v = opts.flags[name];
  return v === true || v === "true";
}

/** Read a string-valued flag, or undefined. */
export function stringFlag(opts: CliOptions, name: string): string | undefined {
  const v = opts.flags[name];
  return typeof v === "string" ? v : undefined;
}

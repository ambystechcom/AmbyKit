import { findProjectRoot } from "../core/paths.js";

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

  async run(opts: CliOptions): Promise<number> {
    this.verbose = flag(opts, "verbose");
    this.dryRun = flag(opts, "dry-run");
    this.assumeYes = flag(opts, "yes") || flag(opts, "y");

    if (this.requiresProject && findProjectRoot(opts.cwd) === null) {
      this.error("Not inside an AmbyKit project (no .amby/ found). Run `ambykit init` first.");
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

  /** The project root, throwing a clear error if absent. */
  protected projectRoot(cwd: string): string {
    const root = findProjectRoot(cwd);
    if (!root) throw new Error("No AmbyKit project found (missing .amby/).");
    return root;
  }

  // --- logging ---
  protected info(msg: string): void {
    console.log(msg);
  }
  protected success(msg: string): void {
    console.log(`✓ ${msg}`);
  }
  protected warn(msg: string): void {
    console.warn(`! ${msg}`);
  }
  protected error(msg: string): void {
    console.error(`✗ ${msg}`);
  }
  protected debug(msg: string): void {
    if (this.verbose) console.log(`  ${msg}`);
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

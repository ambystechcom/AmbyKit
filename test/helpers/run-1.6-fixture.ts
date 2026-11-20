import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDir } from "../../src/core/fleet/index.js";

/**
 * Run directories written by the v1.6.0 build (feature 033, US-6): test/fixtures/run-1.6/<kind>/. `install16` replaces a run's
 * state directory with the 1.6.0 files, so the 2.x core continues from exactly what 1.6.0 left on disk.
 */

export type Run16 = "interrupted-mid-run" | "interrupted-mid-merge";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "run-1.6");

export function run16Dir(kind: Run16): string {
  return join(FIXTURES, kind);
}

/** Replace `.amby/fleet/<run>/` of `root` with the 1.6.0 directory for `kind` (the run id in it is `<feature>.1`). */
export function install16(root: string, run: string, kind: Run16): void {
  const dest = runDir(root, run);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(run16Dir(kind), dest, { recursive: true });
}

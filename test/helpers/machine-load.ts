import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The real child_process, not a test file's `vi.mock("node:child_process")` counting wrapper: the probe's own spawns must
// not count as the command's work (see load-independent-budget.ts).
const realChildProcess = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");

/**
 * How slow is this machine right now? (test-flake fix)
 *
 * The "stays under 1 s" tests are performance guarantees, but a single wall-clock sample also measures how busy the machine
 * is: with two full suites running at once, or on a small shared CI runner, the same code takes 1.5-2x longer. Measured on a
 * 32-core Windows machine: a pure CPU loop slowed by 9% under two suites, while file operations slowed 5x and process spawns
 * 3x. The dashboard, trace and fleet commands are file reads and git spawns, so the probe is the same mix: write, read and
 * remove 150 small files, plus a few `git --version` spawns.
 *
 *  - On an idle machine the factor is 1 (it never goes below 1), so the budget is exactly the documented one.
 *  - The factor is the probe's whole slowdown, capped at 6. (A square root was tried first and was too optimistic: with the
 *    desktop busy a command measured 4.2 s while the probe said 1.9x, because Windows file and process costs are what grow.)
 *  - The command under test is never part of the probe: code that gets slower for the same machine state still fails, and the
 *    deterministic spawn-count bound in load-independent-budget.ts catches an accidental extra git call at any load.
 */

/** Milliseconds the probe takes on an idle development machine (32 cores, Windows, Node 24): measured, about 128 ms. */
const IDLE_PROBE_MS = 128;
/** The most a budget is ever stretched. */
const MAX_FACTOR = 6;

/** One fixed file-system and process-spawn workload, returned as elapsed milliseconds. */
export function ioProbeMs(): number {
  const t0 = performance.now();
  const dir = mkdtempSync(join(tmpdir(), "ambykit-probe-"));
  let n = 0;
  try {
    for (let i = 0; i < 150; i++) writeFileSync(join(dir, `f${i}.md`), "# spec\n".repeat(40));
    for (const f of readdirSync(dir)) n += readFileSync(join(dir, f), "utf8").length + statSync(join(dir, f)).size;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  for (let i = 0; i < 6; i++) realChildProcess.execFileSync("git", ["--version"], { stdio: "ignore" });
  if (n < 0) throw new Error("unreachable");
  return performance.now() - t0;
}

/** The slowdown of this machine right now: 1 when idle, up to 6 when heavily loaded. Uses the median of 3 probes. */
export function loadFactor(): number {
  const samples = [ioProbeMs(), ioProbeMs(), ioProbeMs()].sort((a, b) => a - b);
  return Math.min(MAX_FACTOR, Math.max(1, samples[1]! / IDLE_PROBE_MS));
}

/** A wall-clock budget stretched by the current load (never below the budget itself). */
export function scaledBudget(ms: number): number {
  return ms * loadFactor();
}

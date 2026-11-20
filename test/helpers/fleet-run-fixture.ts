import { RunCommand, type RunDeps } from "../../src/cli/run.js";
import { RUNNERS } from "../../src/core/runners.js";
import { FakePort, fakeRegistry } from "./run-fakes.js";
import { runCommand } from "./run-command.js";

/** A fake process port for fleet tests (nothing is ever spawned). */
export const fakePort = (): FakePort => new FakePort();

export interface FleetRunOptions {
  port?: FakePort;
  /** False keeps the shipped (unverified) registry, so the runner refusal is exercised. */
  registryVerified?: boolean;
  deps?: Partial<RunDeps>;
}

/** `ambykit run <features...>` in-process with a fake port, a fake registry and a no-wait clock. */
export function fleetRun(
  root: string,
  positionals: string[],
  flags: Record<string, string | boolean>,
  opts: FleetRunOptions = {},
): Promise<{ code: number; out: string; err: string }> {
  const cmd = new RunCommand({
    registry: opts.registryVerified === false ? RUNNERS : fakeRegistry(["claude", "codex"]),
    port: opts.port ?? new FakePort(),
    now: () => Date.now(),
    sleep: async () => undefined,
    interactive: false,
    ...(opts.deps ?? {}),
  });
  return runCommand(cmd, root, positionals, flags);
}

// --- real git: several features with their own worktrees (feature 031) ---------------------------

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitProject, gitRun } from "./git-repo.js";
import { commitFile } from "./lane-fixture.js";
import { writeFeatureFiles, type FeatureDef } from "./fleet-plan-fixture.js";
import { addWorktree } from "./worktree-fixture.js";

export interface GitFleetProject {
  root: string;
  /** Feature worktree root per feature dir. */
  roots: Record<string, string>;
}

/** A git project whose features have specs, plans, `[P]` tasks and their own worktree and branch. */
export function gitFleetProject(defs: FeatureDef[]): GitFleetProject {
  const root = gitProject([]);
  gitRun(root, ["config", "core.autocrlf", "false"]);
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["claude", "codex"], worktrees: true }) + "\n");
  writeFileSync(join(root, ".gitignore"), ".worktrees/\n.amby/fleet/\n");
  for (const d of defs) writeFeatureFiles(root, d);
  gitRun(root, ["add", "-A"]);
  gitRun(root, ["commit", "-q", "-m", "fleet fixture"]);
  const roots: Record<string, string> = {};
  for (const d of defs) roots[d.dir] = addWorktree(root, d.dir);
  return { root, roots };
}

/** Commit a file in a feature's worktree (what a finished feature leaves on its branch). */
export function commitIn(p: GitFleetProject, feature: string, rel: string, content: string): void {
  commitFile(p.roots[feature]!, rel, content, `work in ${feature}`);
}

// --- scripted workers for a whole fleet ----------------------------------------------------------

import { mkdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { primaryRoot } from "../../src/core/checkouts.js";

const IDS = /check each off in tasks\.md: ([T0-9, ]+)\./;
const VERDICT = /Write your verdict to (\S+) as JSON/;

export interface WorkerLog {
  /** `<feature>` of each spawned process, in spawn order. */
  spawns: string[];
  /** `<feature>:<job>` where job is worker or review. */
  jobs: string[];
}

const featureOfCwd = (cwd: string): string => /^(.+?)\.lane-/.exec(basename(cwd))?.[1] ?? basename(cwd);

/**
 * Script every process a fleet spawns: a worker ticks its tasks and commits a file in its lane, a reviewer writes a
 * passing verdict. `hold(feature)` makes that feature's workers hang (never finish by themselves).
 */
export function scriptWorkers(port: FakePort, root: string, opts: { hold?: (feature: string) => boolean; failExit?: (feature: string) => number | undefined } = {}): WorkerLog {
  const log: WorkerLog = { spawns: [], jobs: [] };
  port.onSpawn = (proc) => {
    const prompt = proc.spec.stdin ?? "";
    const feature = featureOfCwd(proc.spec.cwd);
    log.spawns.push(feature);
    const review = VERDICT.exec(prompt);
    if (review) {
      log.jobs.push(`${feature}:review`);
      const file = join(primaryRoot(root), review[1]!);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, JSON.stringify({ verdict: "pass", findings: [] }));
      proc.finish(0);
      return;
    }
    log.jobs.push(`${feature}:worker`);
    const m = IDS.exec(prompt);
    const exit = opts.failExit?.(feature);
    if (exit !== undefined) {
      proc.finish(exit);
      return;
    }
    if (m && !opts.hold?.(feature)) {
      const file = join(proc.spec.cwd, "specs", feature, "tasks.md");
      let text = readFileSync(file, "utf8");
      for (const id of m[1]!.split(",").map((x) => x.trim())) text = text.replace(`- [ ] [${id}]`, `- [x] [${id}]`);
      writeFileSync(file, text);
      commitFile(proc.spec.cwd, `src/${basename(proc.spec.cwd)}.ts`, "work\n", "worker commit");
      proc.finish(0);
    }
  };
  return log;
}

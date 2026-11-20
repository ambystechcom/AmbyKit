import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LaunchEntry } from "../core/run-launch-plan.js";
import { primaryRoot } from "../core/checkouts.js";
import { FLEET_DIR, ensureFleetRoot } from "../core/fleet/runs.js";
import { withStability } from "../core/run-stability.js";

/**
 * `--emit-script` (feature 028, FR-003): write the plan as `launch.sh` and `launch.ps1`, launching nothing.
 * The scripts start the lanes in batches of `batch` (the total cap) and wait between batches, and they read
 * each prompt from its file, so a person can review and edit both before running them. Project-local only
 * (FR-020). The directory is `.amby/fleet/<feature>.scripts/`: it is not a run (no `run.json`), so emitting a
 * script never blocks a later run.
 */

const sh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const ps = (s: string): string => `'${s.replace(/'/g, "''")}'`;

export function shellScript(feature: string, plan: LaunchEntry[], batch: number): string {
  const lines = ["#!/bin/sh", `# ${withStability(`ambykit run --emit-script for ${feature}`)}. Review before running; nothing has been launched.`, "set -e"];
  let n = 0;
  for (const e of plan) {
    if (!e.command) continue;
    const cmd = [e.command.exe, ...e.command.args].map(sh).join(" ");
    const stdin = e.command.stdin !== undefined ? ` < ${sh(e.promptFile)}` : "";
    lines.push(`(cd ${sh(e.cwd)} && ${cmd}${stdin}) &`);
    n += 1;
    if (n % batch === 0) lines.push("wait");
  }
  if (n % batch !== 0) lines.push("wait");
  return lines.join("\n") + "\n";
}

export function powershellScript(feature: string, plan: LaunchEntry[], batch: number): string {
  const lines = [`# ${withStability(`ambykit run --emit-script for ${feature}`)}. Review before running; nothing has been launched.`, "$ErrorActionPreference = 'Stop'", "$jobs = @()"];
  let n = 0;
  for (const e of plan) {
    if (!e.command) continue;
    const args = e.command.args.map(ps).join(", ");
    const stdin = e.command.stdin !== undefined ? ` -RedirectStandardInput ${ps(e.promptFile)}` : "";
    lines.push(`$jobs += Start-Process -FilePath ${ps(e.command.exe)} -ArgumentList @(${args}) -WorkingDirectory ${ps(e.cwd)}${stdin} -NoNewWindow -PassThru`);
    n += 1;
    if (n % batch === 0) lines.push("$jobs | Wait-Process", "$jobs = @()");
  }
  if (n % batch !== 0) lines.push("$jobs | Wait-Process");
  return lines.join("\r\n") + "\r\n";
}

export interface EmittedScripts {
  dir: string;
  sh: string;
  ps1: string;
  prompts: string[];
}

/** Write the two scripts and the prompt files they read. Returns the paths; spawns nothing. */
export function emitScripts(root: string, feature: string, plan: LaunchEntry[], batch: number): EmittedScripts {
  const dir = join(primaryRoot(root), FLEET_DIR, `${feature}.scripts`);
  mkdirSync(join(dir, "prompts"), { recursive: true });
  writeFileSync(join(primaryRoot(root), FLEET_DIR, ".gitignore"), "# AmbyKit fleet state (local only)\n*\n", { flag: "a" });
  const prompts: string[] = [];
  const local = plan.map((e) => {
    const file = join(dir, "prompts", `${e.lane}.md`);
    writeFileSync(file, e.prompt.endsWith("\n") ? e.prompt : `${e.prompt}\n`, "utf8");
    prompts.push(file);
    return { ...e, promptFile: file };
  });
  const shPath = join(dir, "launch.sh");
  const psPath = join(dir, "launch.ps1");
  writeFileSync(shPath, shellScript(feature, local, batch), { encoding: "utf8", mode: 0o755 });
  writeFileSync(psPath, powershellScript(feature, local, batch), "utf8");
  return { dir, sh: shPath, ps1: psPath, prompts };
}

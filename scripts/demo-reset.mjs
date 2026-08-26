#!/usr/bin/env node
// Return example/ to its committed state so the next demo take starts clean.
//
//   node scripts/demo-reset.mjs
//
// Only removes paths AmbyKit generates — the ones listed in example/.gitignore. The app's own
// files are never touched.

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const example = join(repoRoot, "example");

const GENERATED = [
  ".amby",
  ".claude",
  ".cursor",
  ".github",
  ".agents",
  ".opencode",
  ".gemini",
  "specs",
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
];

let removed = 0;
for (const name of GENERATED) {
  const path = join(example, name);
  if (!existsSync(path)) continue;
  rmSync(path, { recursive: true, force: true });
  console.log(`removed example/${name}`);
  removed++;
}

console.log(removed === 0 ? "example/ is already clean." : `\nReset ${removed} path(s).`);

// Preflight. A missing `tree` does not fail the recording — it records
// `zsh: command not found: tree` into the money shot, and you only notice by stepping through
// frames afterwards. Say so here, before the take.
const missing = ["vhs", "tree"].filter(
  (bin) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status !== 0,
);

if (missing.length > 0) {
  console.log("");
  console.log(`⚠ Not on PATH: ${missing.join(", ")}`);
  console.log(`  Install with: brew install ${missing.join(" ")}`);
  console.log("  Recording without them produces a GIF full of 'command not found'.");
  process.exitCode = 1;
}

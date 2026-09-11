#!/usr/bin/env node
// Rebuild .demo/ from scratch so the next demo take starts clean.
//
//   node scripts/demo-reset.mjs
//
// .demo/ is gitignored and entirely generated: this removes it and re-scaffolds TaskFlow, so
// nothing AmbyKit emitted during a previous take survives into the next one. A leftover .claude/
// makes init report "created 37" instead of 49, which is easy to miss until you step through the
// recorded frames.

import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { demoDir, scaffold } from "./demo-scaffold.mjs";

if (existsSync(demoDir)) {
  rmSync(demoDir, { recursive: true, force: true });
  console.log("removed .demo/");
}

console.log(`scaffolded ${scaffold()} file(s) into .demo/`);

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

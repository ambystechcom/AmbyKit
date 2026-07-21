#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BaseCommand, CliOptions } from "./base-command.js";
import { banner } from "./banner.js";
import { detectCapabilities } from "./ui/capabilities.js";
import * as render from "./ui/render.js";
import { InitCommand } from "./init.js";
import { SyncCommand } from "./sync.js";
import { AddCommand } from "./add.js";
import { DashboardCommand } from "./dashboard.js";
import { AnalyzeCommand } from "./analyze.js";
import { CheckCommand } from "./check.js";
import { RestoreCommand } from "./restore.js";
import { UpdateCommand } from "./update.js";
import { outdatedWarning } from "./ui/callout.js";
import { packageVersion } from "../core/paths.js";

const COMMANDS: BaseCommand[] = [
  new InitCommand(),
  new AddCommand(),
  new SyncCommand(),
  new DashboardCommand(),
  new AnalyzeCommand(),
  new CheckCommand(),
  new RestoreCommand(),
  new UpdateCommand(),
];

/** Parse argv (after the command name) into positionals + flags. */
export function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const token of argv) {
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq === -1) flags[body] = true;
      else flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (token.startsWith("-") && token.length > 1) {
      for (const ch of token.slice(1)) flags[ch] = true;
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

async function printHelp(): Promise<void> {
  const caps = detectCapabilities();
  console.log(banner(caps));
  // The outdated-version callout sits between the banner and the usage/commands, like every command
  // shows it between the banner and its content (feature 010, US-1).
  if (caps.isTTY) {
    const warning = await outdatedWarning(caps);
    if (warning) console.log(warning);
  }
  console.log("Usage: ambykit <command> [options]\n");
  console.log("Commands:");
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  for (const c of COMMANDS) console.log(`  ${c.name.padEnd(width)}  ${c.summary}`);
  console.log("\nGlobal options: --verbose  --dry-run  --yes\n");
  console.log("Run `ambykit <command> --help` for usage.");
}

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "--help" || name === "-h" || name === "help") {
    await printHelp();
    return 0;
  }
  if (name === "--version" || name === "-v") {
    console.log(packageVersion());
    return 0;
  }
  const command = COMMANDS.find((c) => c.name === name);
  if (!command) {
    console.error(render.error(detectCapabilities(), `Unknown command: ${name}`));
    await printHelp();
    return 1;
  }
  const { positionals, flags } = parseArgs(rest);
  if (flags["help"] || flags["h"]) {
    console.log(`Usage: ${command.usage}\n\n${command.summary}`);
    return 0;
  }
  const opts: CliOptions = { cwd: process.cwd(), positionals, flags };
  return command.run(opts);
}

// Run only when invoked as the CLI entry point — importing this module (e.g. in tests) must not
// execute the CLI. Resolve real paths so a symlinked/global bin still matches.
function isEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invoked);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

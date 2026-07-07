#!/usr/bin/env node
import type { BaseCommand, CliOptions } from "./base-command.js";
import { banner } from "./banner.js";
import { InitCommand } from "./init.js";
import { SyncCommand } from "./sync.js";
import { AddCommand } from "./add.js";
import { DashboardCommand } from "./dashboard.js";
import { AnalyzeCommand } from "./analyze.js";
import { CheckCommand } from "./check.js";
import { UpgradeCommand } from "./upgrade.js";

const VERSION = "0.0.0";

const COMMANDS: BaseCommand[] = [
  new InitCommand(),
  new AddCommand(),
  new SyncCommand(),
  new DashboardCommand(),
  new AnalyzeCommand(),
  new CheckCommand(),
  new UpgradeCommand(),
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

function printHelp(): void {
  console.log(banner());
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
    printHelp();
    return 0;
  }
  if (name === "--version" || name === "-v") {
    console.log(VERSION);
    return 0;
  }
  const command = COMMANDS.find((c) => c.name === name);
  if (!command) {
    console.error(`✗ Unknown command: ${name}`);
    printHelp();
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

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });

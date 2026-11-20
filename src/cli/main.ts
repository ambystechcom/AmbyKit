// The CLI proper: command registry, argument parsing and `main`. `index.ts` is the launcher that checks the Node version first.
import type { BaseCommand, CliOptions } from "./base-command.js";
import { banner } from "./ui/banner.js";
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
import { WorktreeCommand } from "./worktree.js";
import { ActivityCommand } from "./activity.js";
import { LaneCommand } from "./lane.js";
import { GraphCommand } from "./graph.js";
import { TraceCommand } from "./trace.js";
import { McpCommand } from "./mcp.js";
import { DirectiveCommand } from "./directive.js";
import { FleetCommand } from "./fleet.js";
import { RunCommand } from "./run.js";
import { MigrateCommand } from "./migrate.js";
import { EditCommand } from "./edit.js";
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
  new WorktreeCommand(),
  new ActivityCommand(),
  new LaneCommand(),
  new GraphCommand(),
  new TraceCommand(),
  new McpCommand(),
  new DirectiveCommand(),
  new FleetCommand(),
  new RunCommand(),
  new MigrateCommand(),
  new EditCommand(),
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

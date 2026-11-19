import type { Readable, Writable } from "node:stream";
import { BaseCommand, type CliOptions } from "./base-command.js";
import { runServer } from "../mcp/server.js";

/**
 * `ambykit mcp` — serve AmbyKit's state tools over MCP on stdio (feature 025). Started by the assistant
 * from the project root or a lane worktree. stdout is protocol-only, so this command overrides `run` to
 * skip the banner and version callout the other verbs print; every diagnostic goes to stderr.
 */
export class McpCommand extends BaseCommand {
  readonly name = "mcp";
  readonly summary = "Serve AmbyKit state tools to an assistant over MCP (stdio).";
  readonly usage = "ambykit mcp";
  protected override requiresProject = false;

  /** stdout is the protocol; the server reads no specs through a command run. */
  protected override get showsLegacyWarning(): boolean {
    return false;
  }

  /** The streams to serve on: the real stdin and stdout unless a test injects its own. */
  constructor(private readonly io: { input: Readable; output: Writable } = { input: process.stdin, output: process.stdout }) {
    super();
  }

  override async run(opts: CliOptions): Promise<number> {
    return this.execute(opts);
  }

  protected async execute(opts: CliOptions): Promise<number> {
    await runServer({ cwd: opts.cwd, input: this.io.input, output: this.io.output });
    return 0;
  }
}

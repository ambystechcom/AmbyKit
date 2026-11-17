import type { Readable, Writable } from "node:stream";
import { packageVersion } from "../core/paths.js";
import { serveStdio } from "./protocol.js";
import { buildRegistry } from "./tools/index.js";

/** Start the AmbyKit MCP server on the given streams (stdin and stdout when run as `ambykit mcp`). */
export function runServer(opts: { cwd: string; input: Readable; output: Writable }): Promise<void> {
  return serveStdio({
    input: opts.input,
    output: opts.output,
    registry: buildRegistry(),
    ctx: { cwd: opts.cwd },
    info: { name: "ambykit", version: packageVersion() },
  });
}

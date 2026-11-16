import { PassThrough } from "node:stream";
import { serveStdio } from "../../src/mcp/protocol.js";
import { buildRegistry } from "../../src/mcp/tools/index.js";
import type { ToolRegistry } from "../../src/mcp/registry.js";

export interface Rpc {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

/** Send the given lines to a server over in-memory streams and return its replies, in order. */
export async function converse(lines: unknown[], opts: { cwd?: string; registry?: ToolRegistry } = {}): Promise<Rpc[]> {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on("data", (c: Buffer) => chunks.push(c.toString("utf8")));
  const done = serveStdio({
    input,
    output,
    registry: opts.registry ?? buildRegistry(),
    ctx: { cwd: opts.cwd ?? process.cwd() },
    info: { name: "ambykit", version: "test" },
  });
  for (const l of lines) input.write((typeof l === "string" ? l : JSON.stringify(l)) + "\n");
  input.end();
  await done;
  return chunks
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Rpc);
}

/** Call one tool and parse its JSON text result. */
export async function callTool(name: string, args: unknown, opts: { cwd?: string } = {}): Promise<{ body: any; isError: boolean; raw: string }> {
  const [reply] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }], opts);
  const raw = reply!.result.content[0].text as string;
  return { body: JSON.parse(raw), isError: reply!.result.isError === true, raw };
}

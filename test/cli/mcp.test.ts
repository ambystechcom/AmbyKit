import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { McpCommand } from "../../src/cli/mcp.js";

describe("ambykit mcp", () => {
  it("025:FR-001: an MCP client can initialize, then list the registered tools", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (c: Buffer) => chunks.push(c.toString("utf8")));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const done = new McpCommand({ input, output }).run({ cwd: process.cwd(), positionals: [], flags: {} });
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    input.end();
    const code = await done;
    const printed = log.mock.calls.length;
    log.mockRestore();
    const replies = chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(code).toBe(0);
    expect(replies[0].result.serverInfo.name).toBe("ambykit");
    expect(Array.isArray(replies[1].result.tools)).toBe(true);
    expect(printed).toBe(0); // stdout is protocol-only: no banner, no version callout
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/mcp/registry.js";
import { SUPPORTED_VERSIONS } from "../../src/mcp/protocol.js";
import { converse } from "./helpers.js";

const echo = new ToolRegistry().register({
  name: "echo",
  description: "Echo the text back.",
  input: z.object({ text: z.string() }),
  handler: ({ text }) => ({ echoed: text }),
});

describe("MCP stdio protocol", () => {
  it("025:FR-001: answers initialize with the client's version when supported, else the newest legacy one", async () => {
    const [a, b] = await converse([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } },
    ]);
    expect(a!.result.protocolVersion).toBe("2025-06-18");
    expect(b!.result.protocolVersion).toBe("2025-11-25");
    expect(a!.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(a!.result.serverInfo.name).toBe("ambykit");
  });

  it("025:FR-001: serves the handshake-free 2026-07-28 revision: server/discover and per-request _meta", async () => {
    const [d, l] = await converse(
      [
        { jsonrpc: "2.0", id: 1, method: "server/discover" },
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } } },
      ],
      { registry: echo },
    );
    expect(d!.result.supportedVersions).toEqual([...SUPPORTED_VERSIONS]);
    expect(l!.result.tools.map((t: { name: string }) => t.name)).toEqual(["echo"]);
  });

  it("025:FR-001: refuses an unsupported _meta version with -32022 and the supported list", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2030-01-01" } } }]);
    expect(r!.error?.code).toBe(-32022);
    expect(r!.error?.data).toEqual({ supported: [...SUPPORTED_VERSIONS] });
  });

  it("025:FR-001: ping answers, notifications get no reply, unknown methods are -32601", async () => {
    const replies = await converse([
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 2, method: "resources/list" },
    ]);
    expect(replies).toHaveLength(2);
    expect(replies[0]).toMatchObject({ id: 1, result: {} });
    expect(replies[1]!.error?.code).toBe(-32601);
  });

  it("025:FR-001: a malformed line is a parse error and the server keeps serving", async () => {
    const replies = await converse(["{not json", { jsonrpc: "2.0", id: 5, method: "ping" }]);
    expect(replies[0]!.error?.code).toBe(-32700);
    expect(replies[1]).toMatchObject({ id: 5, result: {} });
  });

  it("025:FR-001: a batch is answered as one array line", async () => {
    const replies = await converse([
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", id: 2, method: "ping" },
      ],
    ]);
    expect(replies).toHaveLength(1);
    expect(Array.isArray(replies[0])).toBe(true);
  });

  it("025:FR-001: tools/call runs a tool and wraps the result as one JSON text item", async () => {
    const [r] = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "echo", arguments: { text: "hi" } } }], { registry: echo });
    expect(r!.result.content).toEqual([{ type: "text", text: JSON.stringify({ echoed: "hi" }) }]);
    expect(r!.result.isError).toBeUndefined();
  });

  it("025:FR-001: a result holding a newline still travels as one line", async () => {
    const replies = await converse([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "echo", arguments: { text: "a\nb" } } }], { registry: echo });
    expect(replies).toHaveLength(1);
    expect(JSON.parse(replies[0]!.result.content[0].text)).toEqual({ echoed: "a\nb" });
  });
});

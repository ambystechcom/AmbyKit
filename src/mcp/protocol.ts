import type { Readable, Writable } from "node:stream";
import type { ToolContext, ToolRegistry } from "./registry.js";

/**
 * Newline-delimited JSON-RPC 2.0 over stdio (feature 025, T014). Hand-rolled on purpose (plan open
 * decision 1): the server needs `initialize`, `server/discover`, `ping`, `tools/list` and `tools/call`.
 * Stateless, so one dispatcher serves both protocol generations: the `initialize` handshake of
 * 2024-11-05 to 2025-11-25 and the handshake-free 2026-07-28 revision, which puts the version in each
 * request's `_meta` (see `specs/025-mcp-server/research.md`).
 */

export const SUPPORTED_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25", "2026-07-28"] as const;
/** The newest revision that still has the `initialize` handshake; offered to a client we cannot match. */
export const LEGACY_LATEST = "2025-11-25";
export const META_VERSION_KEY = "io.modelcontextprotocol/protocolVersion";

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const UNSUPPORTED_VERSION = -32022;

export interface ServerInfo {
  name: string;
  version: string;
}

type Id = string | number | null;
export interface RpcResponse {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id, code: number, message: string, data?: unknown): RpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

const isSupported = (v: unknown): v is (typeof SUPPORTED_VERSIONS)[number] =>
  typeof v === "string" && (SUPPORTED_VERSIONS as readonly string[]).includes(v);

const CAPABILITIES = { tools: { listChanged: false } };

/** Answer one parsed message. Notifications (no `id`) and responses get no reply (`null`). */
export async function handleMessage(msg: unknown, registry: ToolRegistry, ctx: ToolContext, info: ServerInfo): Promise<RpcResponse | null> {
  if (typeof msg !== "object" || msg === null || Array.isArray(msg)) return fail(null, INVALID_REQUEST, "invalid request");
  const m = msg as { id?: Id; method?: unknown; params?: Record<string, unknown> };
  const hasId = "id" in m && m.id !== undefined;
  if (typeof m.method !== "string") return hasId ? fail(m.id ?? null, INVALID_REQUEST, "missing method") : null;
  if (!hasId) return null; // a notification, e.g. notifications/initialized
  const id = m.id ?? null;
  const params = m.params ?? {};

  const meta = params["_meta"] as Record<string, unknown> | undefined;
  const asked = meta?.[META_VERSION_KEY];
  if (asked !== undefined && !isSupported(asked)) {
    return fail(id, UNSUPPORTED_VERSION, `unsupported protocol version '${String(asked)}'`, { supported: [...SUPPORTED_VERSIONS] });
  }

  switch (m.method) {
    case "initialize": {
      const wanted = params["protocolVersion"];
      const protocolVersion = isSupported(wanted) ? wanted : LEGACY_LATEST;
      return ok(id, { protocolVersion, capabilities: CAPABILITIES, serverInfo: info });
    }
    case "server/discover":
      return ok(id, { supportedVersions: [...SUPPORTED_VERSIONS], capabilities: CAPABILITIES, serverInfo: info });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: registry.list() });
    case "tools/call": {
      const name = params["name"];
      if (typeof name !== "string") return fail(id, INVALID_REQUEST, "tools/call needs a tool name");
      return ok(id, await registry.call(name, params["arguments"], ctx));
    }
    default:
      return fail(id, METHOD_NOT_FOUND, `method not found: ${m.method}`);
  }
}

/** Handle one line: a single message or a batch (2025-03-26 allowed them). Returns the line to write, if any. */
export async function handleLine(line: string, registry: ToolRegistry, ctx: ToolContext, info: ServerInfo): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return JSON.stringify(fail(null, PARSE_ERROR, "parse error"));
  }
  if (Array.isArray(parsed)) {
    const replies = (await Promise.all(parsed.map((m) => handleMessage(m, registry, ctx, info)))).filter((r): r is RpcResponse => r !== null);
    return replies.length > 0 ? JSON.stringify(replies) : null;
  }
  const reply = await handleMessage(parsed, registry, ctx, info);
  return reply ? JSON.stringify(reply) : null;
}

/**
 * Serve until `input` ends. stdout carries protocol messages only, one per line with no embedded
 * newline; anything else belongs on stderr.
 */
export function serveStdio(opts: { input: Readable; output: Writable; registry: ToolRegistry; ctx: ToolContext; info: ServerInfo }): Promise<void> {
  const { input, output, registry, ctx, info } = opts;
  return new Promise((resolve) => {
    let buffer = "";
    let pending = Promise.resolve();
    const run = (line: string): void => {
      const text = line.trim();
      if (!text) return;
      pending = pending.then(async () => {
        const reply = await handleLine(text, registry, ctx, info);
        if (reply !== null) output.write(reply + "\n");
      });
    };
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        run(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    input.on("end", () => {
      run(buffer);
      buffer = "";
      void pending.then(() => resolve());
    });
  });
}

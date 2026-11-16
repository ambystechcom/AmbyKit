import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { runCommand } from "../helpers/run-command.js";

const ENTRY = { type: "stdio", command: "ambykit", args: ["mcp"] };

function project(tools: string[], mcp = true): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-syncmcp-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools, ...(mcp ? { mcp: { enabled: true } } : {}) }));
  return root;
}
const sync = (root: string, flags: Record<string, string | boolean> = {}) => runCommand(new SyncCommand(), root, [], flags);

describe("ambykit sync with the MCP server enabled (feature 025)", () => {
  const saved = { home: process.env["HOME"], profile: process.env["USERPROFILE"] };
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ambykit-home-"));
    process.env["HOME"] = home; // user-level files must never reach the real home directory
    process.env["USERPROFILE"] = home;
  });
  afterEach(() => {
    if (saved.home === undefined) delete process.env["HOME"];
    else process.env["HOME"] = saved.home;
    if (saved.profile === undefined) delete process.env["USERPROFILE"];
    else process.env["USERPROFILE"] = saved.profile;
  });

  it("025:FR-019: writes the verified project file, and a second sync produces no diff", async () => {
    const root = project(["claude"]);
    expect((await sync(root)).code).toBe(0);
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"))).toEqual({ mcpServers: { ambykit: ENTRY } });
    const again = await sync(root);
    expect(again.code).toBe(0);
    expect((await sync(root, { check: true })).code).toBe(0);
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe(JSON.stringify({ mcpServers: { ambykit: ENTRY } }, null, 2) + "\n");
  });

  it("025:FR-018: names each enabled target that has no verified MCP format, and writes nothing for it", async () => {
    const root = project(["claude", "opencode", "codex"]);
    const out = await sync(root);
    const text = `${out.out}\n${out.err}`;
    expect(text).toMatch(/MCP server config not written for 2 enabled target/);
    expect(text).toMatch(/opencode: .*two incompatible/);
    expect(text).toMatch(/codex: /);
    expect(existsSync(join(root, "opencode.json"))).toBe(false);
    expect(existsSync(join(root, ".codex"))).toBe(false);
  });

  it("025:FR-017: with the server not enabled sync writes no MCP file and says nothing about MCP", async () => {
    const root = project(["claude", "opencode"], false);
    const out = await sync(root);
    expect(existsSync(join(root, ".mcp.json"))).toBe(false);
    expect(`${out.out}\n${out.err}`).not.toMatch(/MCP/);
  });

  it("025:FR-018: the Copilot CLI's user-level file is not written without --include-user, and the real home is untouched", async () => {
    const root = project(["copilot-cli"]);
    await sync(root);
    expect(existsSync(join(home, ".copilot", "mcp-config.json"))).toBe(false);
    expect(readdirSync(home)).toEqual([]);
  });

  it("025:FR-018: --include-user writes it (to the home directory only), and --check never counts user-level files", async () => {
    const root = project(["copilot-cli"]);
    expect((await sync(root, { "include-user": true })).code).toBe(0);
    const written = JSON.parse(readFileSync(join(home, ".copilot", "mcp-config.json"), "utf8"));
    expect(written).toEqual({ mcpServers: { ambykit: { type: "local", command: "ambykit", args: ["mcp"], tools: ["*"] } } });
    writeFileSync(join(home, ".copilot", "mcp-config.json"), "{}"); // user-level drift
    expect((await sync(root, { check: true, "include-user": true })).code).toBe(0);
  });

  it("025:FR-019: an existing .mcp.json keeps the user's servers, and a backup is taken", async () => {
    const root = project(["claude"]);
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { mine: { command: "x" } } }, null, 2) + "\n");
    await sync(root);
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")).mcpServers).toEqual({ mine: { command: "x" }, ambykit: ENTRY });
    expect(readdirSync(join(root, ".amby", "backups")).some((n) => n.startsWith(".mcp.json"))).toBe(true);
  });

  it("025:FR-018: a config file that is not plain JSON is reported and left byte-identical", async () => {
    const root = project(["claude"]);
    const commented = '{\n  // mine\n  "mcpServers": {}\n}\n';
    writeFileSync(join(root, ".mcp.json"), commented);
    const out = await sync(root);
    expect(out.code).toBe(0);
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe(commented);
    expect(`${out.out}\n${out.err}`).toMatch(/not plain JSON/);
  });

  it("025:FR-019: --check reports drift when the entry is missing and is clean after a sync", async () => {
    const root = project(["claude"]);
    await sync(root);
    expect((await sync(root, { check: true })).code).toBe(0);
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: {} }));
    expect((await sync(root, { check: true })).code).toBe(1);
    await sync(root);
    expect((await sync(root, { check: true })).code).toBe(0);
  });
});

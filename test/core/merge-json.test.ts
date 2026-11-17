import { describe, expect, it } from "vitest";
import { mergeJsonEntry } from "../../src/core/merge-json.js";

const entry = { type: "stdio", command: "ambykit", args: ["mcp"] };

describe("mergeJsonEntry", () => {
  it("025:FR-019: creates the file with just the key and entry when there is none", () => {
    const out = mergeJsonEntry(null, "mcpServers", "ambykit", entry);
    expect(out).toEqual({ action: "created", contents: JSON.stringify({ mcpServers: { ambykit: entry } }, null, 2) + "\n" });
    expect(mergeJsonEntry("  \n", "mcpServers", "ambykit", entry).action).toBe("created");
  });

  it("025:FR-019: adds <key>.ambykit and preserves every other key and its order", () => {
    const existing = JSON.stringify({ theme: "dark", mcpServers: { zeta: { command: "z" }, alpha: { command: "a" } }, last: 1 }, null, 2) + "\n";
    const out = mergeJsonEntry(existing, "mcpServers", "ambykit", entry);
    expect(out.action).toBe("updated");
    if (out.action === "skipped") return;
    const parsed = JSON.parse(out.contents);
    expect(Object.keys(parsed)).toEqual(["theme", "mcpServers", "last"]);
    expect(Object.keys(parsed.mcpServers)).toEqual(["zeta", "alpha", "ambykit"]);
    expect(parsed.mcpServers.zeta).toEqual({ command: "z" });
  });

  it("025:FR-019: adds the key itself when the file has other keys only", () => {
    const out = mergeJsonEntry('{"theme":"dark"}', "servers", "ambykit", entry);
    expect(out.action).toBe("updated");
    expect(out.action !== "skipped" && JSON.parse(out.contents)).toEqual({ theme: "dark", servers: { ambykit: entry } });
  });

  it("025:FR-019: a second merge of the same entry is unchanged and returns the text untouched", () => {
    const first = mergeJsonEntry('{"a":1}', "mcpServers", "ambykit", entry);
    if (first.action === "skipped") throw new Error("unexpected");
    const second = mergeJsonEntry(first.contents, "mcpServers", "ambykit", entry);
    expect(second).toEqual({ action: "unchanged", contents: first.contents });
  });

  it("025:FR-019: a user's reordering of our entry's keys is not a change", () => {
    const reordered = '{"mcpServers":{"ambykit":{"args":["mcp"],"command":"ambykit","type":"stdio"}}}';
    expect(mergeJsonEntry(reordered, "mcpServers", "ambykit", entry).action).toBe("unchanged");
  });

  it("025:FR-019: a stale entry is replaced, leaving siblings alone", () => {
    const out = mergeJsonEntry('{"mcpServers":{"ambykit":{"command":"old"},"other":{"command":"x"}}}', "mcpServers", "ambykit", entry);
    expect(out.action).toBe("updated");
    const parsed = out.action !== "skipped" && JSON.parse(out.contents);
    expect(parsed.mcpServers.ambykit).toEqual(entry);
    expect(parsed.mcpServers.other).toEqual({ command: "x" });
  });

  it("025:FR-018: skips a file that is not plain JSON (comments), a non-object root, and a non-object key", () => {
    expect(mergeJsonEntry('{\n  // my servers\n  "mcp": {}\n}', "mcp", "ambykit", entry)).toMatchObject({ action: "skipped", reason: expect.stringMatching(/not plain JSON/) });
    expect(mergeJsonEntry('{"a":1,}', "mcp", "ambykit", entry).action).toBe("skipped");
    expect(mergeJsonEntry("[1,2]", "mcp", "ambykit", entry).action).toBe("skipped");
    expect(mergeJsonEntry('{"mcpServers":[]}', "mcpServers", "ambykit", entry)).toMatchObject({ action: "skipped", reason: expect.stringMatching(/not an object/) });
  });

  it("025:FR-019: keeps tab or four-space indentation, CRLF and a missing final newline", () => {
    const tabs = mergeJsonEntry('{\n\t"a": 1\n}\n', "mcpServers", "ambykit", entry);
    expect(tabs.action !== "skipped" && tabs.contents).toMatch(/\n\t"a": 1/);
    const four = mergeJsonEntry('{\n    "a": 1\n}\n', "mcpServers", "ambykit", entry);
    expect(four.action !== "skipped" && four.contents).toMatch(/\n    "a": 1/);
    const crlf = mergeJsonEntry('{\r\n  "a": 1\r\n}\r\n', "mcpServers", "ambykit", entry);
    expect(crlf.action !== "skipped" && crlf.contents.replace(/\r\n/g, "")).not.toContain("\n");
    const noFinal = mergeJsonEntry('{\n  "a": 1\n}', "mcpServers", "ambykit", entry);
    expect(noFinal.action !== "skipped" && noFinal.contents.endsWith("}")).toBe(true);
  });

  it("025:FR-019: reads a file that starts with a byte-order mark", () => {
    const out = mergeJsonEntry("﻿" + '{"a":1}', "mcpServers", "ambykit", entry);
    expect(out.action).toBe("updated");
  });
});

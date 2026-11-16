import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/mcp/registry.js";

const make = () =>
  new ToolRegistry()
    .register({ name: "add", description: "Add.", input: z.object({ a: z.number(), b: z.number().optional() }), handler: ({ a, b }) => ({ sum: a + (b ?? 0) }) })
    .register({ name: "bad", description: "Fails.", input: z.object({}), handler: () => ({ error: "feature '999' not found" }) })
    .register({ name: "soft", description: "Warns.", input: z.object({}), handler: () => ({ ack: true, warning: "no run" }) })
    .register({
      name: "boom",
      description: "Throws.",
      input: z.object({}),
      handler: () => {
        throw new Error("kaput");
      },
    });

const ctx = { cwd: process.cwd() };
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0]!.text);

describe("tool registry", () => {
  it("025:FR-001: publishes each tool's JSON schema without the $schema key", () => {
    const tools = make().list();
    expect(tools.map((t) => t.name)).toEqual(["add", "bad", "soft", "boom"]);
    expect(tools[0]!.inputSchema).toMatchObject({ type: "object", required: ["a"] });
    expect(tools[0]!.inputSchema["$schema"]).toBeUndefined();
  });

  it("025:FR-002: invalid input is an isError result naming the field", async () => {
    const r = await make().call("add", { a: "x" }, ctx);
    expect(r.isError).toBe(true);
    expect(parse(r).error).toMatch(/a: /);
  });

  it("025:FR-002: an unknown tool is an error listing the real ones", async () => {
    const r = await make().call("nope", {}, ctx);
    expect(r.isError).toBe(true);
    expect(parse(r).tools).toContain("add");
  });

  it("025:FR-002: a handler's { error } is an isError result", async () => {
    const r = await make().call("bad", {}, ctx);
    expect(r.isError).toBe(true);
    expect(parse(r)).toEqual({ error: "feature '999' not found" });
  });

  it("025:FR-012: a { warning } result is not an error", async () => {
    const r = await make().call("soft", {}, ctx);
    expect(r.isError).toBeUndefined();
    expect(parse(r)).toEqual({ ack: true, warning: "no run" });
  });

  it("025:FR-012: a throwing handler becomes an error result, never an exception", async () => {
    const r = await make().call("boom", {}, ctx);
    expect(r.isError).toBe(true);
    expect(parse(r).error).toBe("kaput");
  });

  it("refuses to register the same name twice", () => {
    expect(() => make().register({ name: "add", description: "", input: z.object({}), handler: () => ({}) })).toThrow(/already/);
  });
});

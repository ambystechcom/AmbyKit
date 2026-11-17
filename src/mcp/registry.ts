import { z } from "zod";

/**
 * The tool registry (feature 025, T015): zod-validated inputs, published JSON schemas, and one uniform
 * result shape. A handler returns a plain object; `{ error }` marks a failure (FR-002) and `{ warning }`
 * is passed through as a normal result so `report_activity` never fails the agent (FR-012).
 */

export interface ToolContext {
  /** Directory the server was started in: a checkout root or a lane worktree. */
  cwd: string;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  /** Shown to the model; keep it short and put protocol wording here (FR-013, FR-020). */
  description: string;
  input: S;
  handler: (args: z.infer<S>, ctx: ToolContext) => unknown | Promise<unknown>;
}

/** MCP `tools/call` result: one JSON text item, `isError` only for failures. */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface PublishedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export function result(body: unknown, isError = false): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(body) }], ...(isError ? { isError: true } : {}) };
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDef>();

  register<S extends z.ZodType>(tool: ToolDef<S>): this {
    if (this.tools.has(tool.name)) throw new Error(`tool '${tool.name}' is already registered`);
    this.tools.set(tool.name, tool as unknown as ToolDef);
    return this;
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** What `tools/list` returns: each tool's name, description and JSON input schema. */
  list(): PublishedTool[] {
    return [...this.tools.values()].map((t) => {
      const schema = z.toJSONSchema(t.input) as Record<string, unknown>;
      delete schema["$schema"];
      return { name: t.name, description: t.description, inputSchema: schema };
    });
  }

  /** Validate, run and wrap one call. Never throws: every failure is an `isError` result naming the problem. */
  async call(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return result({ error: `unknown tool '${name}'`, tools: this.names() }, true);
    const parsed = tool.input.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const why = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
      return result({ error: `invalid input for ${name}: ${why}` }, true);
    }
    try {
      const out = await tool.handler(parsed.data, ctx);
      const failed = typeof out === "object" && out !== null && "error" in out;
      return result(out, failed);
    } catch (err) {
      return result({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  }
}

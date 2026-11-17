import { z } from "zod";
import { findProjectRoot } from "../../core/paths.js";
import type { ToolContext } from "../registry.js";

/** Input fragments shared by the tools; `feature` accepts the number (`025`) or the directory name. */
export const feature = z.string().min(1).describe("Feature number (025) or directory name (025-mcp-server)");
export const lane = z.string().min(1).optional().describe("Lane: lane-1-2, 1-2 or the full name. Omit to use the lane this server runs in.");
export const run = z.string().min(1).optional().describe("Run id, e.g. 025-mcp-server.1. Omit to use the feature's single unfinished run.");

/** The AmbyKit project this server serves, or an error result when it was started outside one. */
export function rootOf(ctx: ToolContext): { root: string } | { error: string } {
  const root = findProjectRoot(ctx.cwd);
  return root ? { root } : { error: `not inside an AmbyKit project (no .amby/ found from ${ctx.cwd})` };
}

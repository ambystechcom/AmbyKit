import { ToolRegistry } from "../registry.js";

/** Every tool the server publishes. Each tool module adds its own registration here. */
export function buildRegistry(): ToolRegistry {
  return new ToolRegistry();
}

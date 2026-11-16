import { ToolRegistry } from "../registry.js";
import { registerReadTools } from "./read.js";

/** Every tool the server publishes. Each tool module adds its own registration here. */
export function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerReadTools(registry);
  return registry;
}

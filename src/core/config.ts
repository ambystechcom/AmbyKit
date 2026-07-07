import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { AmbyConfig } from "./types.js";

const configSchema = z.object({
  version: z.string().default("0.0.0"),
  tools: z.array(z.string()).default([]),
  manageRules: z.boolean().optional(),
});

/** Path to a project's config file. */
export function configPath(projectRoot: string): string {
  return join(projectRoot, ".amby", "config.json");
}

/** Read `.amby/config.json`, or return defaults if absent. */
export function loadConfig(projectRoot: string): AmbyConfig {
  const path = configPath(projectRoot);
  if (!existsSync(path)) return { version: "0.0.0", tools: [] };
  const parsed = configSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed;
}

/** Write `.amby/config.json` deterministically (2-space, trailing newline). */
export function saveConfig(projectRoot: string, config: AmbyConfig): void {
  const path = configPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

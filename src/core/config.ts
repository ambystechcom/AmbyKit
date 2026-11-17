import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { AmbyConfig, FleetConfig } from "./types.js";

const configSchema = z.object({
  version: z.string().default("0.0.0"),
  tools: z.array(z.string()).default([]),
  manageRules: z.boolean().optional(),
  worktrees: z.boolean().optional(),
  dashboard: z
    .object({
      activeMinutes: z.number().positive().optional(),
      idleMinutes: z.number().positive().optional(),
    })
    .optional(),
  mcp: z.object({ enabled: z.boolean() }).optional(),
  fleet: z
    .object({
      stallMinutes: z.number().positive().optional(),
      restartLimit: z.number().int().min(0).optional(),
      concurrency: z
        .object({ total: z.number().int().positive().optional(), perType: z.number().int().positive().optional() })
        .optional(),
      roundLimit: z.number().int().positive().optional(),
      tickSeconds: z.number().positive().optional(),
      budgets: z.record(z.string(), z.number()).optional(),
      workerModel: z.string().optional(),
    })
    .optional(),
  plugins: z.record(z.string(), z.string()).optional(),
  trace: z
    .object({
      roots: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
    })
    .optional(),
});

/** The fleet settings with every default filled in (feature 025, data-model "Config additions"). */
export interface FleetSettings {
  stallMinutes: number;
  restartLimit: number;
  concurrency: { total: number; perType: number };
  roundLimit: number;
  tickSeconds: number;
  budgets: Record<string, number>;
  workerModel?: string;
}

export const FLEET_DEFAULTS = {
  stallMinutes: 15,
  restartLimit: 2,
  concurrency: { total: 3, perType: 2 },
  roundLimit: 3,
  tickSeconds: 30,
} as const;

/** Resolve `config.fleet` against the defaults; the single place those numbers live. */
export function fleetSettings(config: { fleet?: FleetConfig } | null | undefined): FleetSettings {
  const f = config?.fleet ?? {};
  return {
    stallMinutes: f.stallMinutes ?? FLEET_DEFAULTS.stallMinutes,
    restartLimit: f.restartLimit ?? FLEET_DEFAULTS.restartLimit,
    concurrency: {
      total: f.concurrency?.total ?? FLEET_DEFAULTS.concurrency.total,
      perType: f.concurrency?.perType ?? FLEET_DEFAULTS.concurrency.perType,
    },
    roundLimit: f.roundLimit ?? FLEET_DEFAULTS.roundLimit,
    tickSeconds: f.tickSeconds ?? FLEET_DEFAULTS.tickSeconds,
    budgets: f.budgets ?? {},
    ...(f.workerModel ? { workerModel: f.workerModel } : {}),
  };
}

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

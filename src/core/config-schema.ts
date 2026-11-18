// Config schema version (030:FR-014, C-4). `.amby/config.json` carries `schemaVersion`; a config without one is read as
// version 1 and never modified by any command except `migrate`, which upgrades it with every setting preserved, unknown
// fields included. A newer or unparseable config is left alone and reported. Everything here is pure.

/** The schema version written by this release. */
export const CONFIG_SCHEMA_VERSION = 2;

/** Version of a parsed config: a missing or non-numeric `schemaVersion` means 1 (the 1.x shape). */
export function readSchemaVersion(raw: unknown): number {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>)["schemaVersion"] : undefined;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}

export interface UpgradeResult {
  /** The upgraded object (the input is never mutated). */
  config: Record<string, unknown>;
  changed: boolean;
  from: number;
  to: number;
}

/**
 * Add `schemaVersion: 2` (right after `version`), keeping every other key and its order, unknown keys included.
 * A config already at this version or newer comes back unchanged.
 */
export function upgradeConfig(raw: Record<string, unknown>): UpgradeResult {
  const from = readSchemaVersion(raw);
  if (from >= CONFIG_SCHEMA_VERSION) return { config: { ...raw }, changed: false, from, to: from };
  const config: Record<string, unknown> = {};
  let placed = false;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "schemaVersion") continue;
    config[k] = v;
    if (k === "version") {
      config["schemaVersion"] = CONFIG_SCHEMA_VERSION;
      placed = true;
    }
  }
  if (!placed) {
    // no `version` key: put the schema version first so it is easy to find
    return { config: { schemaVersion: CONFIG_SCHEMA_VERSION, ...config }, changed: true, from, to: CONFIG_SCHEMA_VERSION };
  }
  return { config, changed: true, from, to: CONFIG_SCHEMA_VERSION };
}

export type ConfigPlan =
  /** No config file: nothing to upgrade. */
  | { action: "none"; reason: string }
  /** Already current. */
  | { action: "current"; reason: string }
  /** Write `text` (2-space JSON, trailing newline, same shape as `saveConfig`). */
  | { action: "write"; text: string; from: number; to: number }
  /** Leave the file as it is and tell the person why. */
  | { action: "refuse"; kind: "newer" | "unparseable"; reason: string };

/**
 * Decide what `migrate` does with the config file text (FR-014): upgrade a v1 config, leave a current one, and never
 * touch a newer or unparseable one.
 */
export function planConfigUpgrade(text: string | null, file = ".amby/config.json"): ConfigPlan {
  if (text === null) return { action: "none", reason: `${file} not found` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0];
    return { action: "refuse", kind: "unparseable", reason: `${file} is not valid JSON (${msg}); left unchanged — fix it, then run migrate again` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { action: "refuse", kind: "unparseable", reason: `${file} is not a JSON object; left unchanged` };
  }
  const from = readSchemaVersion(parsed);
  if (from > CONFIG_SCHEMA_VERSION) {
    return { action: "refuse", kind: "newer", reason: `${file} is from a newer AmbyKit (schemaVersion ${from}); left unchanged — upgrade the tool` };
  }
  const up = upgradeConfig(parsed as Record<string, unknown>);
  if (!up.changed) return { action: "current", reason: `${file} already has schemaVersion ${from}` };
  return { action: "write", text: JSON.stringify(up.config, null, 2) + "\n", from: up.from, to: up.to };
}

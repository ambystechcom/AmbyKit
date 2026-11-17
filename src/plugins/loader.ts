import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { TargetDef } from "../emitters/index.js";
import { createPluginApi, PLUGIN_API_VERSION, type PluginApi, type PluginModule } from "./api.js";
import { isPluginPackageName, readManifest } from "./manifest.js";
import { isExactVersion, satisfies } from "./semver.js";

/**
 * Loads the plugins a project lists in `.amby/config.json` (feature 027). This is the one place that
 * reads plugin files and runs plugin code, so it is only imported when `plugins` is non-empty (FR-016).
 *
 * Trust rules (FR-006, US-7): only packages named in config are looked at; the config value must be an
 * exact `x.y.z`; the package is found only at `<root>/node_modules/<name>` (no parent or global lookup);
 * and the installed version must equal the pin. There is no sandbox: a loaded plugin runs with the
 * person's permissions.
 */

export interface LoadedPlugin {
  name: string;
  version: string;
  targets: TargetDef[];
}

export interface PluginFailure {
  /** The package as listed in config. */
  name: string;
  reason: string;
}

export interface PluginLoadResult {
  loaded: LoadedPlugin[];
  failures: PluginFailure[];
}

export interface LoaderDeps {
  /** Dynamic import, injectable for tests. Defaults to the real `import()`. */
  importModule?: (url: string) => Promise<unknown>;
  /** The API handed to factory-form plugins. */
  api?: PluginApi;
}

const SURFACES = new Set(["commands", "skills", "workflows", "none"]);

/** The reasons a module's default export is not a usable plugin; empty when it is. Shape, never `instanceof`. */
export function validateShape(mod: unknown): string[] {
  const problems: string[] = [];
  if (!mod || typeof mod !== "object") return ["the default export is not an object or a factory returning one"];
  const targets = (mod as { targets?: unknown }).targets;
  if (!Array.isArray(targets) || targets.length === 0) return ["`targets` must be a non-empty array"];
  targets.forEach((t, i) => {
    const at = `targets[${i}]`;
    if (!t || typeof t !== "object") {
      problems.push(`${at} is not an object`);
      return;
    }
    const target = t as Record<string, unknown>;
    if (typeof target["id"] !== "string" || target["id"] === "") problems.push(`${at}.id must be a non-empty string`);
    if (typeof target["displayName"] !== "string") problems.push(`${at}.displayName must be a string`);
    const e = target["emitter"];
    if (!e || typeof e !== "object") {
      problems.push(`${at}.emitter is missing`);
      return;
    }
    const em = e as Record<string, unknown>;
    if (typeof em["toolId"] !== "string" || em["toolId"] === "") problems.push(`${at}.emitter.toolId must be a non-empty string`);
    if (typeof em["displayName"] !== "string") problems.push(`${at}.emitter.displayName must be a string`);
    if (typeof em["commandSurface"] !== "string" || !SURFACES.has(em["commandSurface"] as string)) {
      problems.push(`${at}.emitter.commandSurface must be one of ${[...SURFACES].join(", ")}`);
    }
    if (typeof em["commandDir"] !== "string") problems.push(`${at}.emitter.commandDir must be a string`);
    if (typeof em["emit"] !== "function") problems.push(`${at}.emitter.emit must be a function`);
  });
  return problems;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadOne(root: string, name: string, pin: string, deps: LoaderDeps): Promise<LoadedPlugin | string> {
  if (!isPluginPackageName(name)) return `'${name}' is not a plugin package name (expected ambykit-emitter-*, optionally scoped)`;
  if (!isExactVersion(pin)) return `listed with '${pin}'; plugins must be pinned to an exact version (x.y.z)`;

  const dir = join(root, "node_modules", ...name.split("/"));
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return `not installed: ${pkgPath} does not exist (only <project>/node_modules is searched)`;

  let text: string;
  try {
    text = readFileSync(pkgPath, "utf8");
  } catch (err) {
    return `cannot read package.json: ${message(err)}`;
  }
  const read = readManifest(text);
  if (!read.ok) return read.reason;
  const { manifest } = read;
  if (manifest.name !== name) return `package.json names '${manifest.name}', not '${name}'`;
  if (manifest.version !== pin) return `installed version ${manifest.version} does not match the pin ${pin}`;

  if (manifest.pluginApi === null) return `declares no plugin API range (add "ambykit": { "pluginApi": "^1" } to its package.json)`;
  const range = satisfies(PLUGIN_API_VERSION, manifest.pluginApi);
  if (!range.supported) return `its plugin API range '${manifest.pluginApi}' is unsupported: ${range.reason}`;
  if (!range.satisfied) return `requires plugin API ${manifest.pluginApi}, but this AmbyKit provides ${PLUGIN_API_VERSION}`;

  const entry = join(dir, manifest.entry);
  if (!existsSync(entry)) return `entry file ${manifest.entry} does not exist`;
  let mod: unknown;
  try {
    mod = await (deps.importModule ?? ((url: string) => import(url)))(pathToFileURL(entry).href);
  } catch (err) {
    return `failed to load: ${message(err)}`;
  }
  let exported: unknown = (mod as { default?: unknown } | null)?.default;
  if (typeof exported === "function") {
    try {
      exported = (exported as (api: PluginApi) => PluginModule)(deps.api ?? createPluginApi());
    } catch (err) {
      return `its factory threw: ${message(err)}`;
    }
  }
  const problems = validateShape(exported);
  if (problems.length > 0) return `bad shape: ${problems.join("; ")}`;
  return { name, version: manifest.version, targets: (exported as PluginModule).targets };
}

/** Load every listed plugin, in listing order. A failure never stops the others (FR-004). */
export async function loadPlugins(
  root: string,
  listed: Record<string, string> | undefined,
  deps: LoaderDeps = {},
): Promise<PluginLoadResult> {
  const result: PluginLoadResult = { loaded: [], failures: [] };
  for (const [name, pin] of Object.entries(listed ?? {})) {
    const one = await loadOne(root, name, pin, deps);
    if (typeof one === "string") result.failures.push({ name, reason: one });
    else result.loaded.push(one);
  }
  return result;
}

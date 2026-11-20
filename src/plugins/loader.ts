import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { TargetDef } from "../emitters/index.js";
import { createPluginApi, PLUGIN_API_1X, PLUGIN_API_VERSION, type PluginApi, type PluginModule } from "./api.js";
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
  /** One-line notes for the person, e.g. that a plugin written for the 1.x API loaded through compatibility (033:FR-009). */
  notes?: string[];
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

/**
 * Feature 033 (FR-009): a plugin written for the 1.x API that reached into something the API does not export fails when it is
 * imported, with an error about a missing export or a package path. Say which name it relied on, that it is not part of the plugin
 * API, and where the name is available if it is (a name the factory's `api` argument provides).
 */
export function importHint(err: unknown): string {
  const text = message(err);
  const missing = /does not provide an export named '([^']+)'/.exec(text)?.[1];
  const subpath = /Package subpath '([^']+)' is not defined by "exports"/.exec(text)?.[1];
  // The names a plugin may use: the factory's argument and the barrel's constant. `MCP_SERVER_NAME` and `MCP_COMMAND` are in the API.
  const api = new Set([...Object.keys(createPluginApi()), "PLUGIN_API_VERSION"]);
  if (missing) {
    if (api.has(missing)) {
      return `failed to load: ${text}. It imported '${missing}' from a module that does not provide it; the name is part of the plugin API: import it from '@ambystech/ambykit/plugin' or use api.${missing} from the factory's argument.`;
    }
    return `failed to load: ${text}. It imported '${missing}', which is not part of the plugin API (docs/stability.md lists the names a plugin may import).`;
  }
  if (subpath) {
    const needs = /base-emitter/.test(subpath) ? " If it needed MCP_SERVER_NAME or MCP_COMMAND, use api.MCP_SERVER_NAME and api.MCP_COMMAND from the factory's argument." : "";
    return `failed to load: ${text}. It imported '${subpath}', which is internal and not part of the plugin API (import only from '@ambystech/ambykit/plugin'; docs/stability.md lists the names).${needs}`;
  }
  return `failed to load: ${text}`;
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

  if (manifest.pluginApi === null) return `declares no plugin API range (add "ambykit": { "pluginApi": "^2" } to its package.json)`;
  const range = satisfies(PLUGIN_API_VERSION, manifest.pluginApi);
  if (!range.supported) return `its plugin API range '${manifest.pluginApi}' is unsupported: ${range.reason}`;
  const notes: string[] = [];
  if (!range.satisfied) {
    // Feature 033 (C-4, FR-009): API 2.0.0 keeps everything 1.0.0 had, so a plugin that targets the 1.x API loads, with a note.
    const legacy = satisfies(PLUGIN_API_1X, manifest.pluginApi);
    if (!legacy.supported || !legacy.satisfied) {
      return `requires plugin API ${manifest.pluginApi}, but this AmbyKit provides ${PLUGIN_API_VERSION} (it accepts plugins declaring ^1 or ^2)`;
    }
    notes.push(`it declares the 1.x plugin API (${manifest.pluginApi}) and loads because API ${PLUGIN_API_VERSION} keeps everything 1.0 had; declare ^2 once you have tested it`);
  }

  const entry = join(dir, manifest.entry);
  if (!existsSync(entry)) return `entry file ${manifest.entry} does not exist`;
  let mod: unknown;
  try {
    mod = await (deps.importModule ?? ((url: string) => import(url)))(pathToFileURL(entry).href);
  } catch (err) {
    return importHint(err);
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
  return { name, version: manifest.version, targets: (exported as PluginModule).targets, ...(notes.length > 0 ? { notes } : {}) };
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

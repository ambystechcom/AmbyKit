/** What the loader needs from a plugin's `package.json` (feature 027). Pure: it is given the file text. */

export const PLUGIN_NAME_PREFIX = "ambykit-emitter-";

const NPM_NAME = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

/** A plugin package is named `ambykit-emitter-*`; a scope is allowed (`@acme/ambykit-emitter-foo`). */
export function isPluginPackageName(name: string): boolean {
  if (!NPM_NAME.test(name)) return false;
  const last = name.split("/").pop() ?? "";
  return last.startsWith(PLUGIN_NAME_PREFIX) && last.length > PLUGIN_NAME_PREFIX.length;
}

export interface PluginManifest {
  name: string;
  version: string;
  /** The declared plugin-API range, from `ambykit.pluginApi`. */
  pluginApi: string | null;
  /** Entry file relative to the package: `exports["."]`, else `main`, else `index.js`. */
  entry: string;
}

export type ManifestResult = { ok: true; manifest: PluginManifest } | { ok: false; reason: string };

function entryOf(pkg: Record<string, unknown>): string {
  const exp = pkg["exports"];
  const dot = typeof exp === "string" ? exp : exp && typeof exp === "object" ? (exp as Record<string, unknown>)["."] : undefined;
  const pick = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return pick(o["import"]) ?? pick(o["default"]);
    }
    return null;
  };
  return pick(dot) ?? (typeof pkg["main"] === "string" ? (pkg["main"] as string) : "index.js");
}

/** Read a plugin manifest from `package.json` text. A reason is returned instead of throwing. */
export function readManifest(text: string): ManifestResult {
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    return { ok: false, reason: "package.json is not valid JSON" };
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return { ok: false, reason: "package.json is not an object" };
  const p = pkg as Record<string, unknown>;
  if (typeof p["name"] !== "string") return { ok: false, reason: "package.json has no name" };
  if (typeof p["version"] !== "string") return { ok: false, reason: "package.json has no version" };
  const meta = p["ambykit"];
  const range = meta && typeof meta === "object" ? (meta as Record<string, unknown>)["pluginApi"] : undefined;
  return {
    ok: true,
    manifest: {
      name: p["name"],
      version: p["version"],
      pluginApi: typeof range === "string" ? range : null,
      entry: entryOf(p),
    },
  };
}

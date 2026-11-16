import type { AmbyConfig } from "../core/types.js";
import type { PluginFailure } from "./loader.js";
import type { TargetCollision, TargetRegistry } from "./registry.js";

/** What `sync`, `check` and `add` need once the listed plugins have been loaded (feature 027). */
export interface PluginSession {
  registry: TargetRegistry;
  loaded: { name: string; version: string }[];
  failures: PluginFailure[];
  collisions: TargetCollision[];
}

/**
 * Load the plugins listed in config. With no `plugins` key (or an empty one) this returns `undefined`
 * without importing the loader, so a project that never lists a plugin runs exactly as before (FR-016).
 */
export async function loadPluginSession(root: string, config: Pick<AmbyConfig, "plugins">): Promise<PluginSession | undefined> {
  if (!config.plugins || Object.keys(config.plugins).length === 0) return undefined;
  const [{ loadPlugins }, { buildRegistry }, { TARGETS }] = await Promise.all([
    import("./loader.js"),
    import("./registry.js"),
    import("../emitters/index.js"),
  ]);
  const { loaded, failures } = await loadPlugins(root, config.plugins);
  const registry = buildRegistry(TARGETS, loaded);
  return {
    registry,
    loaded: loaded.map((p) => ({ name: p.name, version: p.version })),
    failures,
    collisions: registry.collisions,
  };
}

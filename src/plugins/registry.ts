import type { TargetDef, TargetSource } from "../emitters/index.js";

/** Who owns a target id: `built-in`, or a plugin package name. */
export type TargetOwner = "built-in" | string;

export interface PluginTargets {
  /** Package name as listed in config. */
  name: string;
  version: string;
  targets: TargetDef[];
}

/** A plugin target that was not registered because its id was already taken. */
export interface TargetCollision {
  id: string;
  /** The plugin whose target was rejected. */
  plugin: string;
  /** The earlier owner of the id: `built-in` or another plugin's package name. */
  with: TargetOwner;
}

export interface TargetRegistry extends TargetSource {
  readonly targets: TargetDef[];
  readonly collisions: TargetCollision[];
  /** Owner of each registered target id. */
  readonly owners: ReadonlyMap<string, TargetOwner>;
  /** Plugin package + version behind an emitter's `toolId`, for error messages. */
  pluginOfTool(toolId: string): { name: string; version: string } | undefined;
}

/**
 * Built-in targets first, then each plugin's targets in the order the plugins are listed. A plugin target
 * whose id equals a built-in's or an earlier plugin's is reported and left out: nothing is overridden
 * (feature 027, FR-005). Pure.
 */
export function buildRegistry(builtins: readonly TargetDef[], plugins: readonly PluginTargets[]): TargetRegistry {
  const targets: TargetDef[] = [...builtins];
  const owners = new Map<string, TargetOwner>(builtins.map((t) => [t.id, "built-in"]));
  const collisions: TargetCollision[] = [];
  const tools = new Map<string, { name: string; version: string }>();
  for (const plugin of plugins) {
    for (const target of plugin.targets) {
      const owner = owners.get(target.id);
      if (owner !== undefined) {
        collisions.push({ id: target.id, plugin: plugin.name, with: owner });
        continue;
      }
      owners.set(target.id, plugin.name);
      targets.push(target);
      tools.set(target.emitter.toolId, { name: plugin.name, version: plugin.version });
    }
  }
  return { targets, collisions, owners, pluginOfTool: (toolId) => tools.get(toolId) };
}

/** One line per collision for `sync` and `check`, naming both owners. */
export function describeCollision(c: TargetCollision): string {
  const other = c.with === "built-in" ? "a built-in target" : `a target from plugin ${c.with}`;
  return `Plugin ${c.plugin} defines target '${c.id}', which is already ${other}; the plugin's target was not registered.`;
}

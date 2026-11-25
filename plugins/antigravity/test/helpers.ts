import { TARGETS } from "../../../src/emitters/index.js";
import { createPluginApi } from "../../../src/plugins/api.js";
import { buildRegistry, type TargetRegistry } from "../../../src/plugins/registry.js";
import { emitFiles, type EmitOptions } from "../../../test/helpers/emit-target.js";
import type { EmittedFile } from "../../../src/core/types.js";
import factory from "../src/index.js";

/** The 2.0 registry with the real plugin installed: the built-in targets plus this plugin's two. */
export const pluginRegistry: TargetRegistry = buildRegistry(TARGETS, [
  { name: "@ambystech/ambykit-emitter-antigravity", version: "1.0.0", targets: factory(createPluginApi()).targets },
]);

export function emitWithPlugin(tools: string[], opts: EmitOptions = {}): EmittedFile[] {
  return emitFiles(tools, opts, pluginRegistry);
}

/** Sorted path to contents record, like `emitTarget` in core's helper. */
export function emitTargetWithPlugin(tools: string | string[], opts: EmitOptions = {}): Record<string, string> {
  const files = emitWithPlugin(Array.isArray(tools) ? tools : [tools], opts);
  return Object.fromEntries(files.map((f) => [f.path, f.contents]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

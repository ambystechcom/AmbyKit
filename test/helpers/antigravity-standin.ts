import { TARGETS } from "../../src/emitters/index.js";
import { createPluginApi } from "../../src/plugins/api.js";
import { buildRegistry, type TargetRegistry } from "../../src/plugins/registry.js";
import { emitFiles as emitFilesWith, type EmitOptions } from "./emit-target.js";
import type { EmittedFile } from "../../src/core/types.js";
// @ts-expect-error a plain JS fixture without types
import factory from "../fixtures/plugins/@ambystech/ambykit-emitter-antigravity/index.js";

/** Name the project config uses for the stand-in (feature 036, T053): `plugins: { [STANDIN]: "1.0.0" }`. */
export const STANDIN = "@ambystech/ambykit-emitter-antigravity";

/** The built-in targets plus the Antigravity stand-in, the registry a 2.0 project with the plugin installed sees. */
export const standInRegistry: TargetRegistry = buildRegistry(TARGETS, [
  { name: STANDIN, version: "1.0.0", targets: (factory(createPluginApi()) as { targets: never[] }).targets },
]);

/** Files emitted for `tools` through the stand-in registry. */
export function emitFilesWithStandIn(tools: string[], opts: EmitOptions = {}): EmittedFile[] {
  return emitFilesWith(tools, opts, standInRegistry);
}

/** `emitFilesWithStandIn` as a sorted path to contents record. */
export function emitTargetWithStandIn(tools: string | string[], opts: EmitOptions = {}): Record<string, string> {
  const files = emitFilesWithStandIn(Array.isArray(tools) ? tools : [tools], opts);
  return Object.fromEntries(files.map((f) => [f.path, f.contents]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

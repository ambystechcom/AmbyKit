/** Library entry point — re-exports the core model and emitters for programmatic use. */
export * from "./core/index.js";
export * from "./emitters/index.js";
/** Plugin API (feature 027, experimental): the loader, registry and range check stay internal. */
export { PLUGIN_API_VERSION, PLUGIN_API_EXPERIMENTAL } from "./plugins/api.js";
export type { PluginModule, PluginFactory, PluginApi } from "./plugins/api.js";
export { skillName, skillPath, skillFrontmatter } from "./emitters/skills-emitter.js";
export { tomlBasic, tomlPrompt } from "./emitters/toml-command-emitter.js";

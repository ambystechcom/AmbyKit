/**
 * The plugin API (feature 027, EXPERIMENTAL in 1.6): everything a plugin author may import from
 * `@ambystech/ambykit/plugin`. The loader, registry and range checker are internal and are not exported.
 */
export { BaseEmitter, SkillsEmitter, TomlCommandEmitter } from "../emitters/index.js";
export type { TargetDef } from "../emitters/index.js";
export { skillName, skillPath, skillFrontmatter } from "../emitters/skills-emitter.js";
export { tomlBasic, tomlPrompt } from "../emitters/toml-command-emitter.js";
export { MCP_SERVER_NAME, MCP_COMMAND } from "../emitters/base-emitter.js";
export type { CommandSpec, CommandSurface, EmittedFile, RulesContext, Role } from "../core/types.js";
export { PLUGIN_API_VERSION, PLUGIN_API_EXPERIMENTAL } from "./api.js";
export type { PluginModule, PluginFactory, PluginApi } from "./api.js";

import type { TargetDef } from "../emitters/index.js";
import {
  BaseEmitter,
  SkillsEmitter,
  TomlCommandEmitter,
} from "../emitters/index.js";
import { MCP_COMMAND, MCP_SERVER_NAME } from "../emitters/base-emitter.js";
import { skillFrontmatter, skillName, skillPath } from "../emitters/skills-emitter.js";
import { tomlBasic, tomlPrompt } from "../emitters/toml-command-emitter.js";

/**
 * The plugin API version. Plugins declare the range they support in `package.json`
 * (`"ambykit": { "pluginApi": "^1" }`); the loader refuses a plugin whose range does not contain it.
 */
export const PLUGIN_API_VERSION = "1.0.0";

/**
 * True in 1.6: the plugin API may change in minor releases until it is frozen at 2.0 (feature 027,
 * FR-011). The loader prints a note while this is true.
 */
export const PLUGIN_API_EXPERIMENTAL = true;

/** What a plugin package's default export provides, in its object form. */
export interface PluginModule {
  /** Targets this plugin adds. Each is the same shape as a built-in target. */
  targets: TargetDef[];
}

/**
 * The extension points handed to a plugin factory. A plugin installed next to a different copy of AmbyKit
 * would otherwise subclass a foreign `BaseEmitter`; the factory form always receives the running copy's.
 */
export interface PluginApi {
  BaseEmitter: typeof BaseEmitter;
  SkillsEmitter: typeof SkillsEmitter;
  TomlCommandEmitter: typeof TomlCommandEmitter;
  skillName: typeof skillName;
  skillPath: typeof skillPath;
  skillFrontmatter: typeof skillFrontmatter;
  tomlBasic: typeof tomlBasic;
  tomlPrompt: typeof tomlPrompt;
  /**
   * The name AmbyKit's MCP server is registered under in a host's MCP config, and how the host starts it
   * (feature 036, an addition to the 027 API). An emitter whose host has a project MCP file passes these to the
   * inherited `mcpFile()` helper instead of copying the strings.
   */
  MCP_SERVER_NAME: typeof MCP_SERVER_NAME;
  MCP_COMMAND: typeof MCP_COMMAND;
  /** The API version this AmbyKit provides. */
  apiVersion: string;
}

/** The default export of a plugin package may also be a factory that receives the API. */
export type PluginFactory = (api: PluginApi) => PluginModule;

/** The extension points, as passed to a factory. */
export function createPluginApi(): PluginApi {
  return {
    BaseEmitter,
    SkillsEmitter,
    TomlCommandEmitter,
    skillName,
    skillPath,
    skillFrontmatter,
    tomlBasic,
    tomlPrompt,
    MCP_SERVER_NAME,
    MCP_COMMAND,
    apiVersion: PLUGIN_API_VERSION,
  };
}

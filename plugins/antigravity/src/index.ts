import type { EmittedFile, PluginApi, PluginModule, RulesContext } from "@ambystech/ambykit/plugin";

/**
 * Google Antigravity for AmbyKit, as an official plugin (spec 036): the IDE target (`antigravity`) and the CLI target
 * (`antigravity-cli`, the `agy` command). Both write the phase skills the way AmbyKit 1.x did, byte for byte
 * (`test/equivalence.test.ts` compares them with the emitters that shipped inside AmbyKit 1.6).
 *
 * Antigravity retired workflows on 2026-10-19 and replaced them with skills: one directory per phase at
 * `.agents/skills/<name>/SKILL.md` with `name` and `description` (https://antigravity.google/docs/skills). The CLI turns each
 * skill into a slash command named after the skill (`/amby-specify`). Antigravity reads AGENTS.md natively, so no
 * tool-specific rules file is written. There is no file-based agent format (SDK only). The `agy` CLI shares the IDE's workspace
 * files; only the `--agent=` self-report id and the MCP file differ.
 *
 * Everything comes from the factory's `api` argument, so the classes always extend the running copy of AmbyKit.
 */
export default function (api: PluginApi): PluginModule {
  class AntigravityEmitter extends api.SkillsEmitter {
    readonly toolId: string = "antigravity";
    readonly displayName: string = "Antigravity (IDE)";
    readonly commandDir: string = ".agents/skills";

    /**
     * Not written for the IDE. Antigravity's documented project file `.agents/mcp_config.json` is confirmed for the CLI only,
     * and the IDE's own documented config is user-level with conflicting paths in other guides.
     */
    override mcpSkipReason(): string | null {
      return "the Antigravity IDE's MCP config location is unconfirmed (the CLI's project file is verified); add the server by hand";
    }
  }

  class AntigravityCliEmitter extends AntigravityEmitter {
    override readonly toolId = "antigravity-cli";
    override readonly displayName = "Antigravity CLI";

    /** Workspace `.agents/mcp_config.json`, `mcpServers.ambykit` (verified for the CLI). */
    override mcpFiles(_ctx: RulesContext): EmittedFile[] {
      return [this.mcpFile(".agents/mcp_config.json", "mcpServers", { ...api.MCP_COMMAND })];
    }

    override mcpSkipReason(): string | null {
      return null;
    }
  }

  return {
    targets: [
      { id: "antigravity", displayName: "Antigravity (IDE)", emitter: new AntigravityEmitter() },
      { id: "antigravity-cli", displayName: "Antigravity CLI", emitter: new AntigravityCliEmitter() },
    ],
  };
}

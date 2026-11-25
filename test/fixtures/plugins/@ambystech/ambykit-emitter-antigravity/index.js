// Stands in for the published @ambystech/ambykit-emitter-antigravity in core tests (under its real name, so the moved-target check sees it installed) (feature 036, T053): the same two targets with the same ids,
// tool ids, directory and MCP behaviour, so the core behaviours that still mention Antigravity (stale 1.x workflows, the shared
// `.agents/skills` output, the `--agent=` self-report order, the project MCP file) are tested without the published package.
// The plugin's own tests (plugins/antigravity/test) check the real one against the recorded goldens.
export default function (api) {
  class AntigravityEmitter extends api.SkillsEmitter {
    toolId = "antigravity";
    displayName = "Antigravity (IDE)";
    commandDir = ".agents/skills";

    mcpSkipReason() {
      return "the Antigravity IDE's MCP config location is unconfirmed (the CLI's project file is verified); add the server by hand";
    }
  }

  class AntigravityCliEmitter extends AntigravityEmitter {
    toolId = "antigravity-cli";
    displayName = "Antigravity CLI";

    mcpFiles(_ctx) {
      return [this.mcpFile(".agents/mcp_config.json", "mcpServers", { ...api.MCP_COMMAND })];
    }

    mcpSkipReason() {
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

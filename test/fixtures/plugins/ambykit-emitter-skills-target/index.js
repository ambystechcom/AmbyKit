// A plugin shaped like the official Antigravity one (feature 036, T002): two targets on `SkillsEmitter` that write
// `.agents/skills/<phase>/SKILL.md`, the second adding a project MCP file through the API's MCP_COMMAND. Core tests use
// it so they never depend on the published package.
import { join } from "node:path/posix";

export default function (api) {
  class SkillsTarget extends api.SkillsEmitter {
    toolId = "skills-target";
    displayName = "Skills target (IDE)";
    commandDir = join(".agents", "skills");

    mcpSkipReason() {
      return "the IDE's MCP config location is unconfirmed; add the server by hand";
    }
  }

  class SkillsTargetCli extends SkillsTarget {
    toolId = "skills-target-cli";
    displayName = "Skills target (CLI)";

    mcpFiles(_ctx) {
      return [this.mcpFile(".agents/mcp_config.json", "mcpServers", { ...api.MCP_COMMAND })];
    }

    mcpSkipReason() {
      return null;
    }
  }

  return {
    targets: [
      { id: "skills-target", displayName: "Skills target (IDE)", emitter: new SkillsTarget() },
      { id: "skills-target-cli", displayName: "Skills target (CLI)", emitter: new SkillsTargetCli() },
    ],
  };
}
